import { DecNode } from "../decorate";

/* ------------------------------------------------------------------ */
/* Attribute name conversion                                           */
/* ------------------------------------------------------------------ */

const JSX_SPECIAL: Record<string, string> = {
  class: "className",
  "xlink:href": "xlinkHref",
  "xlink:actuate": "xlinkActuate",
  "xlink:arcrole": "xlinkArcrole",
  "xlink:role": "xlinkRole",
  "xlink:show": "xlinkShow",
  "xlink:title": "xlinkTitle",
  "xlink:type": "xlinkType",
  "xml:space": "xmlSpace",
  "xml:lang": "xmlLang",
  "xml:base": "xmlBase",
  "xmlns:xlink": "xmlnsXlink",
};

export function jsxAttrName(name: string): string {
  if (JSX_SPECIAL[name]) return JSX_SPECIAL[name];
  if (name.startsWith("data-") || name.startsWith("aria-")) return name;
  if (name.includes("-")) {
    return name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
  }
  return name;
}

/** style="mask-type:alpha" -> `{{ maskType: "alpha" }}` */
function jsxStyleExpression(value: string): string {
  const entries = value
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return null;
      const prop = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      const key = prop.startsWith("--")
        ? JSON.stringify(prop)
        : prop.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
      return `${key}: ${JSON.stringify(val)}`;
    })
    .filter(Boolean);
  return `{{ ${entries.join(", ")} }}`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------ */
/* Serializer                                                          */
/* ------------------------------------------------------------------ */

export interface SerializeOptions {
  mode: "jsx" | "html";
  /**
   * Lets callers replace a node with custom output (used for React
   * subcomponent references). Return null to serialize normally.
   */
  override?: (node: DecNode, indent: string) => string | null;
  /** Raw attribute text appended to the root tag (e.g. `{...props}`). */
  rootExtraRaw?: string;
  /** Replaces the root class attribute entirely (e.g. a cx(...) expression). */
  rootClassRaw?: string;
  /** Adds data-name attributes for the interactive preview inspector. */
  addDataNames?: boolean;
}

const WRAP_THRESHOLD = 100;

export function serialize(
  node: DecNode,
  indent: string,
  opts: SerializeOptions,
  isRoot = true
): string {
  if (!isRoot && opts.override) {
    const replaced = opts.override(node, indent);
    if (replaced !== null) return replaced;
  }

  const jsx = opts.mode === "jsx";
  const parts: string[] = [];

  if (isRoot && opts.rootClassRaw) {
    parts.push(opts.rootClassRaw);
  } else if (node.classes.length > 0) {
    parts.push(`${jsx ? "className" : "class"}="${escapeAttr(node.classes.join(" "))}"`);
  }
  if (node.dataSlot) parts.push(`data-slot="${escapeAttr(node.dataSlot)}"`);
  if (opts.addDataNames && !node.isDef) {
    if (node.name) parts.push(`data-name="${escapeAttr(node.name)}"`);
    if (node.elKey) parts.push(`data-el="${escapeAttr(node.elKey)}"`);
  }

  for (const [name, value] of node.attrs) {
    if (jsx && name === "style") {
      parts.push(`style=${jsxStyleExpression(value)}`);
    } else if (jsx) {
      parts.push(`${jsxAttrName(name)}="${escapeAttr(value)}"`);
    } else {
      parts.push(`${name}="${escapeAttr(value)}"`);
    }
  }
  if (isRoot && opts.rootExtraRaw) parts.push(opts.rootExtraRaw);

  const open = parts.length > 0 ? `<${node.tag} ${parts.join(" ")}` : `<${node.tag}`;
  const oneLineOpen = `${indent}${open}`;
  const elementChildren = node.children;
  const text = node.text?.trim() ?? "";

  let openTag: string;
  if (oneLineOpen.length + 1 <= WRAP_THRESHOLD || parts.length <= 1) {
    openTag = oneLineOpen;
  } else {
    openTag = `${indent}<${node.tag}\n${parts.map((p) => `${indent}  ${p}`).join("\n")}\n${indent}`;
  }

  if (elementChildren.length === 0 && !text) {
    return `${openTag.endsWith(indent) ? openTag : openTag + " "}/>`;
  }

  if (elementChildren.length === 0 && text) {
    const body = jsx && /[{}<>&]/.test(text) ? `{${JSON.stringify(text)}}` : escapeText(text);
    return `${openTag}>${body}</${node.tag}>`;
  }

  const inner = elementChildren
    .map((child) => serialize(child, indent + "  ", opts, false))
    .join("\n");
  return `${openTag}>\n${inner}\n${indent}</${node.tag}>`;
}
