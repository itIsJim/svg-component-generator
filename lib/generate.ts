import { decorate, Framework, Styling } from "./decorate";
import { IRNode, parseSvg } from "./model";
import { kebab, pascal } from "./naming";
import { emitAngular } from "./emit/angular";
import { emitReact } from "./emit/react";
import { emitVue } from "./emit/vue";
import { serialize } from "./emit/markup";

export type { Framework, Styling } from "./decorate";

export interface GeneratedFile {
  name: string;
  language: "tsx" | "vue" | "ts" | "scss";
  code: string;
}

export interface GenerateResult {
  componentName: string;
  files: GeneratedFile[];
  /** Named layers in document order, for code <-> preview linking. */
  layers: { slug: string; name: string }[];
  /** Static markup of the component, used by the sandboxed live preview. */
  previewHtml: string;
  /** CSS that styles the preview exactly like the generated code would. */
  previewCss: string;
  warnings: string[];
}

export function generate(
  svgText: string,
  framework: Framework,
  styling: Styling,
  nameOverride?: string
): GenerateResult {
  const model = parseSvg(svgText);

  const componentName =
    (nameOverride && pascal(nameOverride)) || model.suggestedName;
  const componentSlug = kebab(componentName) ?? "svg-component";

  const dec = decorate(model, styling, componentSlug);
  const files: GeneratedFile[] = [];
  const warnings = [...model.warnings];

  if (styling === "headless" && model.monoFill) {
    warnings.push(
      `Single-color artwork detected (${model.monoFill}); fills were converted to currentColor so you can style the component with CSS \`color\`.`
    );
  }

  if (framework === "react") {
    const scssFile = styling === "scss" ? `${componentSlug}.scss` : null;
    files.push({
      name: `${componentName}.tsx`,
      language: "tsx",
      code: emitReact(dec, componentName, scssFile),
    });
    if (scssFile && dec.scss) {
      files.push({ name: scssFile, language: "scss", code: dec.scss });
    }
  } else if (framework === "vue") {
    files.push({
      name: `${componentName}.vue`,
      language: "vue",
      code: emitVue(dec, componentName, styling),
    });
  } else {
    const scssFile = styling === "scss" ? `${componentSlug}.component.scss` : null;
    files.push({
      name: `${componentSlug}.component.ts`,
      language: "ts",
      code: emitAngular(dec, componentName, componentSlug, scssFile),
    });
    if (scssFile && dec.scss) {
      files.push({
        name: scssFile,
        language: "scss",
        code: `:host {\n  display: contents;\n}\n\n${dec.scss}`,
      });
    }
  }

  // The intrinsic size became a component parameter; the preview renders the
  // defaults, so reinstate width/height as plain attributes there.
  const previewRoot = dec.rootSize
    ? {
        ...dec.root,
        attrs: [
          ["width", dec.rootSize.width] as [string, string],
          ["height", dec.rootSize.height] as [string, string],
          ...dec.root.attrs,
        ],
      }
    : dec.root;
  const previewHtml = serialize(previewRoot, "", { mode: "html", addDataNames: true });

  const layers: { slug: string; name: string }[] = [];
  const collectLayers = (node: IRNode): void => {
    if (node.slug && node.name) layers.push({ slug: node.slug, name: node.name });
    node.children.forEach(collectLayers);
  };
  collectLayers(model.root);

  return {
    componentName,
    files,
    layers,
    previewHtml,
    previewCss: dec.previewCss,
    warnings,
  };
}
