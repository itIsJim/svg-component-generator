import { findSvgRoot, isElement, parseXml, XmlElement } from "./xml";
import { kebab, makeUnique, pascal } from "./naming";

/**
 * Intermediate representation of a design-tool SVG export.
 *
 * Design tools encode layer names, grouping and hierarchy in `id`
 * attributes when ids are included at export time. We lift
 * those ids into `name` for structural nodes, while preserving ids that are
 * referenced through url(#…)/href(#…) (gradients, masks, clip paths).
 */
export interface IRNode {
  tag: string;
  /** Layer name (from the id attribute), null when unnamed. */
  name: string | null;
  /** Unique kebab-case class-safe version of `name`. */
  slug: string | null;
  /** Remaining attributes, in source order. */
  attrs: [string, string][];
  children: IRNode[];
  text: string | null;
  /** True for nodes inside <defs> (and for defs itself). */
  isDef: boolean;
  /** Depth from the root <svg> (svg = 0). */
  depth: number;
  /** Number of element descendants (excluding self). */
  size: number;
}

export interface SvgModel {
  root: IRNode;
  /** Suggested component name derived from the outermost named layer. */
  suggestedName: string;
  /** All slugs present in the tree, in document order. */
  slugs: string[];
  /** If every painted fill uses one single color, that color (headless mode swaps it for currentColor). */
  monoFill: string | null;
  warnings: string[];
}

const REF_ATTR = /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g;

function collectReferencedIds(el: XmlElement, out: Set<string>): void {
  for (const [name, value] of Object.entries(el.attrs)) {
    if (name === "href" || name === "xlink:href") {
      if (value.startsWith("#")) out.add(value.slice(1));
      continue;
    }
    for (const m of value.matchAll(REF_ATTR)) out.add(m[1]);
  }
  for (const child of el.children) {
    if (isElement(child)) collectReferencedIds(child, out);
  }
}

function textContent(el: XmlElement): string | null {
  const parts = el.children.filter((c) => !isElement(c)) as { text: string }[];
  if (parts.length === 0) return null;
  return parts.map((p) => p.text).join("");
}

export function parseSvg(input: string): SvgModel {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste an SVG to get started.");
  if (!trimmed.includes("<svg")) throw new Error("No <svg> element found in the input.");

  const doc = parseXml(trimmed);
  const svg = findSvgRoot(doc);
  if (!svg) throw new Error("No <svg> element found in the input.");

  const warnings: string[] = [];
  const referenced = new Set<string>();
  collectReferencedIds(svg, referenced);

  const uniqueSlug = makeUnique();
  const slugs: string[] = [];
  const fills = new Set<string>();
  let named = 0;
  let pathCount = 0;
  let textCount = 0;

  const build = (el: XmlElement, depth: number, inDefs: boolean): IRNode => {
    const isDef = inDefs || el.tag === "defs";
    if (!isDef && el.tag === "path") pathCount++;
    if (el.tag === "text" || el.tag === "tspan") textCount++;
    const attrs: [string, string][] = [];
    let name: string | null = null;
    let slug: string | null = null;

    for (const [attrName, value] of Object.entries(el.attrs)) {
      if (attrName === "id" && !isDef && !referenced.has(value)) {
        // Structural id -> layer name. Consumed by naming, not kept.
        name = value;
        const k = kebab(value);
        if (k) {
          slug = uniqueSlug(k);
          slugs.push(slug);
          named++;
        }
        continue;
      }
      attrs.push([attrName, value]);
      if (attrName === "fill" && /^#[0-9a-fA-F]{3,8}$/.test(value)) {
        fills.add(value.toLowerCase());
      }
    }

    const children = el.children
      .filter(isElement)
      .map((child) => build(child, depth + 1, isDef));
    const size = children.reduce((sum, c) => sum + c.size + 1, 0);

    return {
      tag: el.tag,
      name,
      slug,
      attrs,
      children,
      text: textContent(el),
      isDef,
      depth,
      size,
    };
  };

  const root = build(svg, 0, false);

  // Derive the suggested component name from *real* layer names only,
  // before synthetic group names are added below.
  const firstNamed = findFirstNamed(root);
  const suggestedName =
    (root.name && pascal(root.name)) ||
    (firstNamed?.name && pascal(firstNamed.name)) ||
    "SvgComponent";

  // Exports without id attributes have anonymous groups.
  // Auto-name substantial ones so hierarchy, classes and subcomponent
  // extraction still work.
  let synthetic = 0;
  const autoName = (node: IRNode): void => {
    for (const child of node.children) {
      if (!child.isDef && child.tag === "g" && !child.name && child.size >= 3) {
        synthetic++;
        child.name = `Group ${synthetic}`;
        child.slug = uniqueSlug(`group-${synthetic}`);
        slugs.push(child.slug);
      }
      autoName(child);
    }
  };
  autoName(root);
  if (synthetic > 0) {
    warnings.push(
      `${synthetic} unnamed group${synthetic > 1 ? "s were" : " was"} auto-named (group-1…) to preserve structure. Name your layers in your design tool for meaningful output.`
    );
  }

  if (named === 0) {
    warnings.push(
      'No layer names found. Export the SVG with id attributes enabled to keep layer names, hierarchy and grouping.'
    );
  }

  if (textCount === 0 && pathCount >= 20) {
    warnings.push(
      "No <text> elements found — text in this export was likely flattened into vector paths. Disable “outline text” in your design tool's SVG export settings to keep real, styleable text."
    );
  }

  return {
    root,
    suggestedName,
    slugs,
    monoFill: fills.size === 1 ? [...fills][0] : null,
    warnings,
  };
}

function findFirstNamed(node: IRNode): IRNode | null {
  if (node.name) return node;
  for (const child of node.children) {
    if (child.isDef) continue;
    const found = findFirstNamed(child);
    if (found) return found;
  }
  return null;
}
