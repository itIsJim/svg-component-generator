import { Decorated } from "../decorate";
import { serialize } from "./markup";

function escapeTemplateLiteral(code: string): string {
  return code.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

export function emitAngular(
  dec: Decorated,
  componentName: string,
  selector: string,
  scssFileName: string | null
): string {
  const sized = dec.rootSize !== null;
  const markup = serialize(dec.root, "    ", {
    mode: "html",
    rootExtraRaw: sized ? '[attr.width]="width" [attr.height]="height"' : undefined,
  });
  const template = escapeTemplateLiteral(markup);

  const styleMeta = scssFileName
    ? `  styleUrls: ["./${scssFileName}"],`
    : "  styles: [`:host { display: contents; }`],";

  const imports = sized ? "Component, Input" : "Component";
  const body = sized
    ? [
        `export class ${componentName}Component {`,
        `  @Input() width: number | string = ${dec.rootSize!.width};`,
        `  @Input() height: number | string = ${dec.rootSize!.height};`,
        "}",
      ]
    : [`export class ${componentName}Component {}`];

  return [
    `import { ${imports} } from "@angular/core";`,
    "",
    "/**",
    ` * ${componentName} — generated from an SVG export.`,
    " * Layer names, grouping and hierarchy are preserved from the source SVG.",
    " */",
    "@Component({",
    `  selector: "${selector}",`,
    "  standalone: true,",
    "  template: `",
    template,
    "  `,",
    styleMeta,
    "})",
    ...body,
  ].join("\n") + "\n";
}
