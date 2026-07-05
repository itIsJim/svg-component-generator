"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CodePanel, JumpTarget } from "@/components/CodePanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { Segmented } from "@/components/Segmented";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Framework, GenerateResult, Styling, generate } from "@/lib/generate";
import { SAMPLE_SVG } from "@/lib/sample";

type Result =
  | { ok: true; value: GenerateResult }
  | { ok: false; error: string }
  | null;

/** Trailing-edge debounce so huge inputs don't regenerate on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function Home() {
  const [svgText, setSvgText] = useState("");
  const [framework, setFramework] = useState<Framework>("react");
  const [styling, setStyling] = useState<Styling>("tailwind");
  const [nameOverride, setNameOverride] = useState("");
  const [dragging, setDragging] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null); // code → preview
  const [previewSlug, setPreviewSlug] = useState<string | null>(null); // preview hover → chip
  const [jump, setJump] = useState<JumpTarget | null>(null); // preview click → scroll code

  // Resizable panes: input column width and preview height, in percent.
  const [inputPct, setInputPct] = useState(50);
  const [previewPct, setPreviewPct] = useState(42);
  const [resizing, setResizing] = useState<"col" | "row" | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const outputRef = useRef<HTMLElement>(null);

  const startResize = (
    direction: "col" | "row",
    onMove: (ev: PointerEvent) => void
  ) => {
    setResizing(direction);
    const stop = () => {
      setResizing(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
  };

  const onColResize = (e: React.PointerEvent) => {
    e.preventDefault();
    startResize("col", (ev) => {
      const rect = mainRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setInputPct(Math.min(75, Math.max(20, pct)));
    });
  };

  const onRowResize = (e: React.PointerEvent) => {
    e.preventDefault();
    startResize("row", (ev) => {
      const rect = outputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((rect.bottom - ev.clientY) / rect.height) * 100;
      setPreviewPct(Math.min(80, Math.max(15, pct)));
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // required to allow dropping files
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    // Ignore leave events fired when moving over child elements.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = Array.from(e.dataTransfer.files).find(
      (f) => f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg")
    );
    if (file) {
      setSvgText(await file.text());
      return;
    }
    // Dragged text/snippets (e.g. straight from an editor or browser).
    const text = e.dataTransfer.getData("text/plain");
    if (text) setSvgText(text);
  };

  const deferredSvg = useDeferredValue(useDebounced(svgText, 250));
  const deferredName = useDeferredValue(useDebounced(nameOverride, 250));

  const result: Result = useMemo(() => {
    if (!deferredSvg.trim()) return null;
    try {
      return {
        ok: true,
        value: generate(deferredSvg, framework, styling, deferredName || undefined),
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }, [deferredSvg, framework, styling, deferredName]);

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <h1 className="text-sm font-semibold tracking-tight">
          <span className="text-sky-600 dark:text-sky-400">SVG</span> → Components
        </h1>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <Segmented
            label="Framework"
            value={framework}
            onChange={setFramework}
            options={[
              { value: "react", label: "React" },
              { value: "vue", label: "Vue" },
              { value: "angular", label: "Angular" },
            ]}
          />
          <Segmented
            label="Styling"
            value={styling}
            onChange={setStyling}
            options={[
              { value: "tailwind", label: "Tailwind" },
              { value: "scss", label: "SCSS" },
              { value: "headless", label: "shadcn (headless)" },
            ]}
          />
          <input
            type="text"
            value={nameOverride}
            onChange={(e) => setNameOverride(e.target.value)}
            placeholder={result?.ok ? result.value.componentName : "Component name"}
            spellCheck={false}
            className="w-36 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 font-mono text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-sky-500 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:placeholder:text-neutral-600 dark:focus:border-sky-700"
          />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main ref={mainRef} className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Input pane */}
        <section
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{ "--input-w": `${inputPct}%` } as React.CSSProperties}
          className="relative flex min-h-0 flex-1 flex-col border-b border-neutral-200 md:w-[var(--input-w)] md:flex-none md:border-b-0 dark:border-neutral-800"
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-xl border-2 border-dashed border-sky-500 bg-sky-50/90 text-sm font-medium text-sky-700 dark:bg-sky-950/80 dark:text-sky-300">
              Drop your .svg file here
            </div>
          )}
          <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              SVG input
            </span>
            <button
              type="button"
              onClick={() => setSvgText(SAMPLE_SVG)}
              className="ml-auto rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Load sample
            </button>
            <button
              type="button"
              onClick={() => setSvgText("")}
              className="rounded-md px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              Clear
            </button>
          </div>
          <textarea
            value={svgText}
            onChange={(e) => setSvgText(e.target.value)}
            placeholder={`Paste an SVG exported from your design tool — or drag & drop the .svg file here…\n\nTip: export with id attributes enabled to keep layer names,\nand keep text as real text (don't outline it) for best results.`}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-neutral-700 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-300 dark:placeholder:text-neutral-600"
          />
          {result?.ok && result.value.warnings.length > 0 && (
            <div className="border-t border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
              {result.value.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
        </section>

        {/* Column resizer */}
        <div
          onPointerDown={onColResize}
          className="hidden w-1 shrink-0 cursor-col-resize border-l border-neutral-200 transition-colors hover:bg-sky-400/40 md:block dark:border-neutral-800"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize input pane"
        />

        {/* Output pane: code on top, preview always in view below.
            Hovering the code highlights the matching layer in the preview. */}
        <section ref={outputRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {result === null && (
            <Empty>Paste an SVG on the left to generate component code.</Empty>
          )}
          {result?.ok === false && (
            <div className="p-6 text-sm">
              <p className="font-medium text-red-600 dark:text-red-400">
                Could not parse that SVG
              </p>
              <p className="mt-1 font-mono text-xs text-red-500/90 dark:text-red-300/80">
                {result.error}
              </p>
            </div>
          )}
          {result?.ok && (
            <>
              <div className="min-h-0 flex-1">
                <CodePanel
                  key={`${framework}-${styling}`}
                  files={result.value.files}
                  layers={result.value.layers}
                  onHoverLayer={setHoveredSlug}
                  chipSlug={previewSlug}
                  jump={jump}
                />
              </div>
              {/* Row resizer */}
              <div
                onPointerDown={onRowResize}
                className="h-1 w-full shrink-0 cursor-row-resize border-t border-neutral-200 transition-colors hover:bg-sky-400/40 dark:border-neutral-800"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize preview pane"
              />
              <div
                style={{ "--preview-h": `${previewPct}%` } as React.CSSProperties}
                className="h-[var(--preview-h)] min-h-[120px] shrink-0"
              >
                <PreviewPanel
                  html={result.value.previewHtml}
                  css={result.value.previewCss}
                  highlight={hoveredSlug}
                  onHoverLayer={setPreviewSlug}
                  onSelectLayer={(slug) =>
                    setJump((prev) => ({ slug, tick: (prev?.tick ?? 0) + 1 }))
                  }
                />
              </div>
            </>
          )}
        </section>
      </main>

      {/* While resizing, block the preview iframe from swallowing pointer
          events and keep the resize cursor everywhere. */}
      {resizing && (
        <div
          className={`fixed inset-0 z-50 select-none ${
            resizing === "col" ? "cursor-col-resize" : "cursor-row-resize"
          }`}
        />
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
      {children}
    </div>
  );
}
