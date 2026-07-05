# SVG → Components

[![License: MIT](https://img.shields.io/badge/License-MIT-22d3ee.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-7c3aed.svg)](#contributing)

Turn **SVG exports from your design tool** into structured, scalable UI components for **React, Vue, or Angular** — styled with **Tailwind**, **SCSS**, or **headless (shadcn-style)** output — with a **live interactive preview**.

Paste (or drag & drop) an exported SVG, pick a framework and a styling mode, copy the generated component. Layer names, grouping and hierarchy defined in your design file are preserved: named groups become CSS classes, `data-slot`s, or dedicated React subcomponents.

> **Live demo:** _add your Vercel URL here after deploying_

![SVG → Components — code view](docs/screenshot-code.png)

<details>
<summary>More screenshots (live preview & dark mode)</summary>

![Live interactive preview](docs/screenshot-preview.png)
![Dark mode](docs/screenshot-dark.png)

</details>

## Why

Design tools export flat SVG markup. Dropping that straight into a codebase gives you an unmaintainable blob: no props, no styling layer, no structure. This tool converts it into an idiomatic component — parametrized, themed, and named after your layers.

## Features

- **One input, nine outputs** — 3 frameworks × 3 styling modes:
  - **React** — typed `.tsx`, props spread onto the root `<svg>`, `className` merging, named groups extracted into subcomponents.
  - **Vue** — single-file component (`<script setup lang="ts">`), attributes fall through to the root `<svg>`.
  - **Angular** — standalone component with inline template (plus a `.scss` file in SCSS mode).
- **Parametrized components** — intrinsic width/height become overridable props/inputs with the design's dimensions as defaults.
- **Styling modes**
  - **Tailwind** — paints, opacity, typography and shape geometry become utilities (`fill-[#7C3AED]`, `text-[13px] font-medium`, `w-[224px] [rx:18px]`, …); layer names are kept as leading semantic classes.
  - **SCSS** — a nested stylesheet mirroring the layer hierarchy, with distinct colors hoisted into `$color-N` design tokens.
  - **Headless (shadcn-style)** — unstyled structure with `data-slot` attributes; single-color artwork becomes `currentColor` so you style it with CSS `color`.
- **Structure-aware parsing** — layer names are read from `id` attributes; ids referenced by `url(#…)` (gradients, masks, clip paths) and everything inside `<defs>` are preserved untouched. Substantial anonymous groups are auto-named so structure survives exports without ids.
- **Live interactive preview** — a sandboxed, dependency-free iframe renders exactly what the generated code renders. Hover to highlight layers, click to select, zoom, switch light/dark/checkerboard backgrounds.
- **Fully client-side** — your SVG never leaves the browser; the app builds to static pages.
- **Zero-dependency engine** — the parser and generators in `lib/` have no runtime dependencies and can be reused outside the app.

## Example

Input (SVG exported with ids):

```svg
<g id="Submit Button">
  <rect id="Button Base" x="8" y="52" width="120" height="32" rx="16" fill="#191823"/>
  <text id="Button Label" x="30" y="72" fill="white" font-size="13" font-weight="600">Search now</text>
</g>
```

Output (React × Tailwind, excerpt):

```tsx
<g className="submit-button">
  <rect className="button-base w-[120px] h-[32px] [rx:16px] fill-[#191823]" x="8" y="52" />
  <text className="button-label fill-white text-[13px] font-semibold" x="30" y="72">Search now</text>
</g>
```

## Getting the most out of your exports

1. Export with **id attributes enabled** — layer names, grouping and hierarchy carry over.
2. Keep text as **real text** — don't outline it at export, or it arrives as unstyleable vector paths (the app warns when it detects this).
3. **Name and group your layers** — the names become class names, slots and component names.

## Getting started

```bash
git clone https://github.com/itIsJim/svg-component-generator.git
cd svg-component-generator
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build                    # production build (static)
npm run lint                     # eslint
npx tsx scripts/smoke.ts         # generator smoke test (all 9 combinations)
npx tsx scripts/smoke.ts --full  # …and print every generated file
```

## How it works

```
SVG text ──▶ lib/xml.ts        minimal XML parser (no deps)
         ──▶ lib/model.ts      IR: layer names, hierarchy, defs/refs, warnings
         ──▶ lib/decorate.ts   styling decisions per mode (+ scss / preview css)
         ──▶ lib/emit/*        React / Vue / Angular serializers
         ──▶ lib/preview.ts    self-contained interactive preview document
```

The UI (`app/`, `components/`) is a thin layer over this pipeline; everything runs in the browser.

## Deploying

Standard Next.js — deploys to [Vercel](https://vercel.com) with zero configuration: import the repo and ship. Everything is statically prerendered; there are no API routes, env vars, or server dependencies.

## Contributing

Issues and PRs are welcome. A good PR:

1. Keeps the `lib/` engine dependency-free.
2. Adds or updates a case in `scripts/smoke.ts` when changing generator output.
3. Passes `npm run lint` and `npm run build`.

If a real-world SVG converts badly, please open an issue and attach the (sanitized) SVG — that's the most valuable bug report this project can get.

## License

[MIT](LICENSE)
