/**
 * Smoke test: runs every framework × styling combination over the bundled
 * sample and prints the output. Run with: npx tsx scripts/smoke.ts [--full]
 */
import { generate, Framework, Styling } from "../lib/generate";
import { buildPreviewDoc } from "../lib/preview";
import { SAMPLE_SVG } from "../lib/sample";

const frameworks: Framework[] = ["react", "vue", "angular"];
const stylings: Styling[] = ["tailwind", "scss", "headless"];
const full = process.argv.includes("--full");

let failures = 0;

for (const fw of frameworks) {
  for (const st of stylings) {
    try {
      const result = generate(SAMPLE_SVG, fw, st);
      const doc = buildPreviewDoc(result.previewHtml, result.previewCss);
      const files = result.files.map((f) => `${f.name} (${f.code.length}b)`).join(", ");
      console.log(`✓ ${fw} × ${st} -> ${result.componentName}: ${files}, preview ${doc.length}b`);
      if (full) {
        for (const file of result.files) {
          console.log(`\n--- ${fw}/${st}/${file.name} ---\n${file.code}`);
        }
      }
    } catch (err) {
      failures++;
      console.error(`✗ ${fw} × ${st} FAILED:`, err);
    }
  }
}

// A degenerate input should produce a friendly error, not a crash elsewhere.
for (const bad of ["", "hello", "<svg><g></svg>"]) {
  try {
    generate(bad, "react", "tailwind");
    console.error(`✗ expected an error for input: ${JSON.stringify(bad)}`);
    failures++;
  } catch (err) {
    console.log(`✓ rejected bad input ${JSON.stringify(bad)}: ${(err as Error).message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll combinations passed.");
