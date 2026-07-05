import { IRNode, SvgModel } from "./model";

export type Framework = "react" | "vue" | "angular";
export type Styling = "tailwind" | "scss" | "headless";

/** IRNode enriched with the styling decision for one styling mode. */
export interface DecNode {
  tag: string;
  name: string | null;
  slug: string | null;
  /** Final class list (layer slug first, then utility classes). */
  classes: string[];
  /** data-slot attribute for headless output. */
  dataSlot: string | null;
  attrs: [string, string][];
  children: DecNode[];
  text: string | null;
  isDef: boolean;
  depth: number;
  size: number;
}

export interface Decorated {
  root: DecNode;
  /**
   * Intrinsic size lifted off the root <svg> so emitters can expose it as
   * component parameters (props / inputs) with these values as defaults.
   */
  rootSize: { width: string; height: string } | null;
  /** SCSS source (scss mode only, otherwise ""). */
  scss: string;
  /**
   * Plain CSS that makes the generated markup render correctly in the
   * sandboxed preview: flattened SCSS, or CSS equivalents of the emitted
   * Tailwind utilities. "" in headless mode.
   */
  previewCss: string;
  /** Root class name used by the scss stylesheet (scss mode only). */
  rootClass: string | null;
}

/* ------------------------------------------------------------------ */
/* Tailwind mapping                                                    */
/* ------------------------------------------------------------------ */

interface Utility {
  cls: string;
  prop: string;
  value: string;
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

function paintUtility(kind: "fill" | "stroke", value: string): Utility | null {
  if (value === "none") return { cls: `${kind}-none`, prop: kind, value: "none" };
  if (value === "currentColor") return { cls: `${kind}-current`, prop: kind, value: "currentColor" };
  if (value === "white") return { cls: `${kind}-white`, prop: kind, value: "#fff" };
  if (value === "black") return { cls: `${kind}-black`, prop: kind, value: "#000" };
  if (HEX.test(value)) return { cls: `${kind}-[${value.toUpperCase()}]`, prop: kind, value };
  return null; // url(#gradient) etc. stay as attributes
}

const NUM = /^[0-9.]+$/;

/** Appends px to bare numbers ("13" -> "13px", "0.01em" stays). */
function px(value: string): string {
  return NUM.test(value) ? `${value}px` : value;
}

const FONT_WEIGHT_UTILITIES: Record<string, string> = {
  "100": "font-thin",
  "200": "font-extralight",
  "300": "font-light",
  "400": "font-normal",
  "500": "font-medium",
  "600": "font-semibold",
  "700": "font-bold",
  "800": "font-extrabold",
  "900": "font-black",
};

/** Tags whose geometry (width/height/radius) is styleable via CSS in SVG2. */
const GEOMETRY_TAGS = new Set(["rect", "circle", "ellipse"]);

function tailwindFor(tag: string, attr: string, value: string): Utility | null {
  switch (attr) {
    case "fill":
      return paintUtility("fill", value);
    case "stroke":
      return paintUtility("stroke", value);
    case "opacity": {
      const n = Number(value);
      if (Number.isNaN(n)) return null;
      const pct = n * 100;
      const cls = Number.isInteger(pct) ? `opacity-${pct}` : `opacity-[${value}]`;
      return { cls, prop: "opacity", value };
    }
    case "stroke-width": {
      if (!NUM.test(value)) return null;
      return { cls: `stroke-[${value}px]`, prop: "stroke-width", value: `${value}px` };
    }
    case "font-size":
      return { cls: `text-[${px(value)}]`, prop: "font-size", value: px(value) };
    case "font-weight":
      return {
        cls: FONT_WEIGHT_UTILITIES[value] ?? `font-[${value}]`,
        prop: "font-weight",
        value,
      };
    case "font-family": {
      const family = value.replace(/['"]/g, "");
      return {
        cls: `font-['${family.replace(/ /g, "_")}']`,
        prop: "font-family",
        value: `"${family}"`,
      };
    }
    case "letter-spacing":
      return { cls: `tracking-[${px(value)}]`, prop: "letter-spacing", value: px(value) };
  }
  if (GEOMETRY_TAGS.has(tag) && NUM.test(value)) {
    switch (attr) {
      case "width":
        return { cls: `w-[${value}px]`, prop: "width", value: `${value}px` };
      case "height":
        return { cls: `h-[${value}px]`, prop: "height", value: `${value}px` };
      case "rx":
      case "ry":
      case "r":
        // Geometry properties have no core utility; arbitrary-property
        // syntax ([rx:14px]) compiles to `rx: 14px` in Tailwind.
        return { cls: `[${attr}:${value}px]`, prop: attr, value: `${value}px` };
    }
  }
  return null;
}

/** Escapes a class name for use in a CSS selector (.fill-\[\#FFF\]). */
function escapeClass(cls: string): string {
  return cls.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

/* ------------------------------------------------------------------ */
/* SCSS rule tree                                                      */
/* ------------------------------------------------------------------ */

interface Rule {
  selector: string;
  decls: [string, string][];
  children: Rule[];
}

const SCSS_PAINT_PROPS = new Set([
  "fill",
  "stroke",
  "stroke-width",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-miterlimit",
]);

const SCSS_TYPO_PROPS = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "text-anchor",
]);

const SCSS_GEOMETRY_PROPS = new Set(["width", "height", "rx", "ry", "r"]);

/** Returns the CSS declaration for an attribute, or null to keep it inline. */
function scssDecl(tag: string, name: string, value: string): [string, string] | null {
  if (SCSS_PAINT_PROPS.has(name)) return [name, value];
  if (SCSS_TYPO_PROPS.has(name)) {
    if (name === "font-family") return [name, `"${value.replace(/['"]/g, "")}"`];
    if (name === "font-size" || name === "letter-spacing") return [name, px(value)];
    return [name, value];
  }
  if (GEOMETRY_TAGS.has(tag) && SCSS_GEOMETRY_PROPS.has(name) && NUM.test(value)) {
    return [name, `${value}px`];
  }
  return null;
}

/**
 * Distinct paint colors become SCSS design tokens ($color-1…N, ordered by
 * how often they're used) so a component can be re-themed in one place.
 */
function collectPalette(rule: Rule): Map<string, string> {
  const counts = new Map<string, number>();
  const walk = (r: Rule) => {
    for (const [prop, value] of r.decls) {
      if ((prop === "fill" || prop === "stroke") && HEX.test(value)) {
        const hex = value.toLowerCase();
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
      }
    }
    r.children.forEach(walk);
  };
  walk(rule);
  const palette = new Map<string, string>();
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([hex], i) => palette.set(hex, `$color-${i + 1}`));
  return palette;
}

function printScss(rule: Rule, indent: string, palette: Map<string, string>): string {
  const lines: string[] = [`${indent}${rule.selector} {`];
  for (const [prop, value] of rule.decls) {
    const token =
      (prop === "fill" || prop === "stroke") && palette.get(value.toLowerCase());
    lines.push(`${indent}  ${prop}: ${token || value};`);
  }
  for (let i = 0; i < rule.children.length; i++) {
    if (rule.decls.length > 0 || i > 0) lines.push("");
    lines.push(printScss(rule.children[i], indent + "  ", palette));
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

/** Drops rules with no declarations and no surviving descendants. */
function pruneEmptyRules(rule: Rule): void {
  rule.children.forEach(pruneEmptyRules);
  rule.children = rule.children.filter(
    (child) => child.decls.length > 0 || child.children.length > 0
  );
}

function flattenCss(rule: Rule, parentSelector: string, out: string[]): void {
  const selector = parentSelector ? `${parentSelector} ${rule.selector}` : rule.selector;
  if (rule.decls.length > 0) {
    out.push(`${selector} { ${rule.decls.map(([p, v]) => `${p}: ${v};`).join(" ")} }`);
  }
  for (const child of rule.children) flattenCss(child, selector, out);
}

/* ------------------------------------------------------------------ */
/* Decoration walk                                                     */
/* ------------------------------------------------------------------ */

export function decorate(model: SvgModel, styling: Styling, componentSlug: string): Decorated {
  const utilities = new Map<string, Utility>();
  const rootClass = styling === "scss" ? model.root.slug ?? componentSlug : null;

  // The intrinsic size becomes a component parameter (prop / input) in the
  // emitters, so it's lifted off the root element in every styling mode.
  let rootSize: Decorated["rootSize"] = null;
  {
    const attrMap = new Map(model.root.attrs);
    const width = attrMap.get("width");
    const height = attrMap.get("height");
    if (width && height && /^[0-9.]+$/.test(width) && /^[0-9.]+$/.test(height)) {
      rootSize = { width, height };
    }
  }

  const walk = (node: IRNode, parentRule: Rule | null): DecNode => {
    const isRoot = node.depth === 0;
    const classes: string[] = [];
    let dataSlot: string | null = null;
    let attrs = node.attrs;
    let rule = parentRule;

    if (isRoot && rootSize) {
      attrs = attrs.filter(([name]) => name !== "width" && name !== "height");
    }

    if (!node.isDef && styling === "tailwind") {
      if (node.slug) classes.push(node.slug);
      const kept: [string, string][] = [];
      for (const [name, value] of attrs) {
        const util = tailwindFor(node.tag, name, value);
        if (util) {
          classes.push(util.cls);
          utilities.set(util.cls, util);
        } else {
          kept.push([name, value]);
        }
      }
      attrs = kept;
    } else if (!node.isDef && styling === "scss") {
      const ownClass = isRoot ? rootClass : node.slug;
      if (ownClass) {
        classes.push(ownClass);
        const decls: [string, string][] = [];
        const kept: [string, string][] = [];
        for (const [name, value] of attrs) {
          const decl = scssDecl(node.tag, name, value);
          if (decl) {
            decls.push(decl);
          } else {
            kept.push([name, value]);
          }
        }
        attrs = kept;
        const own: Rule = { selector: `.${ownClass}`, decls, children: [] };
        if (parentRule) parentRule.children.push(own);
        rule = own;
      }
    } else if (!node.isDef && styling === "headless") {
      if (node.slug && !isRoot) dataSlot = node.slug;
      if (model.monoFill) {
        attrs = attrs.map(([name, value]) =>
          name === "fill" && value.toLowerCase() === model.monoFill
            ? [name, "currentColor"]
            : [name, value]
        );
      }
    }

    return {
      tag: node.tag,
      name: node.name,
      slug: node.slug,
      classes,
      dataSlot,
      attrs,
      children: node.children.map((child) => walk(child, rule)),
      text: node.text,
      isDef: node.isDef,
      depth: node.depth,
      size: node.size,
    };
  };

  // For scss mode the root rule is created inside walk(); track it via a
  // sentinel parent so we can retrieve it afterwards.
  const sentinel: Rule = { selector: "", decls: [], children: [] };
  const root = walk(model.root, styling === "scss" ? sentinel : null);

  let scss = "";
  let previewCss = "";

  if (styling === "scss" && sentinel.children.length > 0) {
    const rootRule = sentinel.children[0];
    pruneEmptyRules(rootRule);
    rootRule.decls.unshift(["display", "block"]);
    const palette = collectPalette(rootRule);
    const tokens =
      palette.size > 0
        ? "// Design tokens extracted from the artwork (most used first).\n" +
          [...palette.entries()].map(([hex, name]) => `${name}: ${hex};`).join("\n") +
          "\n\n"
        : "";
    scss = tokens + printScss(rootRule, "", palette) + "\n";
    const flat: string[] = [];
    flattenCss(rootRule, "", flat);
    previewCss = flat.join("\n");
  } else if (styling === "tailwind") {
    previewCss = [...utilities.values()]
      .map((u) => `.${escapeClass(u.cls)} { ${u.prop}: ${u.value}; }`)
      .join("\n");
  }

  return { root, rootSize, scss, previewCss, rootClass };
}
