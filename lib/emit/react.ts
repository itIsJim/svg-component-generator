import { Decorated, DecNode } from "../decorate";
import { makeUnique, pascal } from "../naming";
import { serialize } from "./markup";

const MAX_SUBCOMPONENTS = 12;
const MIN_GROUP_SIZE = 3;
const MAX_GROUP_DEPTH = 3;

/**
 * Named source groups become dedicated subcomponents so the output mirrors
 * the design's hierarchy and stays readable for large exports.
 */
function pickSubcomponents(root: DecNode, reservedName: string): Map<DecNode, string> {
  const picked = new Map<DecNode, string>();
  const unique = makeUnique("");
  unique(reservedName); // the main component owns this name

  const walk = (node: DecNode) => {
    for (const child of node.children) {
      if (child.isDef) continue;
      if (picked.size < MAX_SUBCOMPONENTS && child.tag === "g" && child.slug && child.name) {
        if (child.size >= MIN_GROUP_SIZE && child.depth <= MAX_GROUP_DEPTH) {
          const name = pascal(child.name);
          if (name) picked.set(child, unique(name));
        }
      }
      walk(child);
    }
  };
  walk(root);
  return picked;
}

export function emitReact(
  dec: Decorated,
  componentName: string,
  scssFileName: string | null
): string {
  const subs = pickSubcomponents(dec.root, componentName);
  let current: DecNode = dec.root;

  const override = (node: DecNode, indent: string): string | null => {
    if (node === current) return null;
    const name = subs.get(node);
    return name ? `${indent}<${name} />` : null;
  };

  const rootClasses = dec.root.classes.join(" ");
  const needsCx = rootClasses.length > 0;
  const rootClassRaw = needsCx
    ? `className={cx("${rootClasses}", className)}`
    : "className={className}";

  const sized = dec.rootSize !== null;
  const params = sized
    ? `{ className, width = ${dec.rootSize!.width}, height = ${dec.rootSize!.height}, ...props }`
    : "{ className, ...props }";

  const rootJsx = serialize(dec.root, "    ", {
    mode: "jsx",
    override,
    rootClassRaw,
    rootExtraRaw: sized ? "width={width} height={height} {...props}" : "{...props}",
  });

  const lines: string[] = [];
  if (scssFileName) lines.push(`import "./${scssFileName}";`);
  lines.push(`import type { SVGProps } from "react";`, "");
  lines.push(
    "/**",
    ` * ${componentName} — generated from an SVG export.`,
    " * Layer names, grouping and hierarchy are preserved from the source SVG.",
    " */"
  );
  lines.push(
    `export default function ${componentName}(${params}: SVGProps<SVGSVGElement>) {`,
    "  return (",
    rootJsx,
    "  );",
    "}"
  );

  for (const [node, name] of subs) {
    current = node;
    const jsx = serialize(node, "    ", { mode: "jsx", override });
    lines.push("", `function ${name}() {`, "  return (", jsx, "  );", "}");
  }

  if (needsCx) {
    lines.push(
      "",
      "function cx(...parts: Array<string | undefined>) {",
      '  return parts.filter(Boolean).join(" ") || undefined;',
      "}"
    );
  }

  return lines.join("\n") + "\n";
}
