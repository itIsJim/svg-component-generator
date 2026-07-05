import { Decorated } from "../decorate";
import { serialize } from "./markup";

export function emitVue(dec: Decorated, componentName: string, styling: string): string {
  const sized = dec.rootSize !== null;
  const markup = serialize(dec.root, "  ", {
    mode: "html",
    rootExtraRaw: sized ? ':width="width" :height="height"' : undefined,
  });

  const script = sized
    ? [
        '<script setup lang="ts">',
        "// Layer names, grouping and hierarchy are preserved from the source SVG.",
        "// Classes / attributes set on the component fall through to the root <svg>.",
        "withDefaults(defineProps<{ width?: number | string; height?: number | string }>(), {",
        `  width: ${dec.rootSize!.width},`,
        `  height: ${dec.rootSize!.height},`,
        "});",
        "</script>",
      ]
    : [
        '<script setup lang="ts">',
        "// Layer names, grouping and hierarchy are preserved from the source SVG.",
        "// Classes / attributes set on the component fall through to the root <svg>.",
        "</script>",
      ];

  const parts: string[] = [
    "<template>",
    `  <!-- ${componentName} — generated from an SVG export. -->`,
    markup,
    "</template>",
    "",
    ...script,
  ];

  if (styling === "scss" && dec.scss) {
    parts.push("", '<style scoped lang="scss">', dec.scss.trimEnd(), "</style>");
  }

  return parts.join("\n") + "\n";
}
