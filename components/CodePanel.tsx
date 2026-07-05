"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GeneratedFile } from "@/lib/generate";
import { buildLineMap } from "@/lib/linemap";

const MAX_RENDERED_CHARS = 150_000;
const LINE_HEIGHT = 18; // px — enforced via leading-[18px] on the <pre>
const PRE_PADDING = 16; // px — p-4

export interface JumpTarget {
  slug: string | null;
  /** Bumped on every click so repeated clicks on the same layer re-scroll. */
  tick: number;
}

interface CodePanelProps {
  files: GeneratedFile[];
  layers: { slug: string; name: string }[];
  /** Fired with the layer slug under the cursor (null when none). */
  onHoverLayer: (slug: string | null) => void;
  /** Layer name to show in the toolbar chip (preview hover). */
  chipSlug?: string | null;
  /** Scroll-and-highlight request (preview click). */
  jump?: JumpTarget | null;
}

export function CodePanel({
  files,
  layers,
  onHoverLayer,
  chipSlug = null,
  jump = null,
}: CodePanelProps) {
  // The parent remounts this panel (via key) when framework/styling change,
  // so `active` only needs clamping for edits that shrink the file list.
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lastSlug = useRef<string | null>(null);

  const file = files[Math.min(active, files.length - 1)];
  const code = file?.code ?? "";

  // Rendering megabytes of text into the DOM freezes the tab; cap the view.
  // Copy always uses the full file.
  const truncated = code.length > MAX_RENDERED_CHARS;
  const shown = truncated
    ? code.slice(0, code.lastIndexOf("\n", MAX_RENDERED_CHARS))
    : code;

  const slugs = useMemo(() => layers.map((l) => l.slug), [layers]);
  const nameBySlug = useMemo(
    () => new Map(layers.map((l) => [l.slug, l.name])),
    [layers]
  );
  const lineMap = useMemo(() => buildLineMap(shown, slugs), [shown, slugs]);

  // Contiguous line ranges for the layer clicked in the preview.
  const highlightRanges = useMemo(() => {
    if (!jump?.slug) return [];
    const ranges: [number, number][] = [];
    for (let i = 0; i < lineMap.length; i++) {
      if (lineMap[i] !== jump.slug) continue;
      const last = ranges[ranges.length - 1];
      if (last && last[1] === i - 1) last[1] = i;
      else ranges.push([i, i]);
    }
    return ranges;
  }, [jump, lineMap]);

  // Clicking a layer in the artwork jumps the code to its first occurrence.
  useEffect(() => {
    if (!jump?.slug || highlightRanges.length === 0) return;
    const pre = preRef.current;
    if (!pre) return;
    const top = PRE_PADDING + highlightRanges[0][0] * LINE_HEIGHT;
    pre.scrollTo({ top: Math.max(0, top - pre.clientHeight / 3), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  if (!file) return null;

  // Element keys are either a layer slug or "<scope>/<tag>~<n>" for unnamed
  // elements; render the latter as e.g. "<path> 3 · CTA Button".
  const labelFor = (key: string): string => {
    const named = nameBySlug.get(key);
    if (named) return named;
    const m = key.match(/^(.+)\/([a-zA-Z0-9-]+)~(\d+)$/);
    if (!m) return key;
    const scope = m[1] === "~root" ? "root" : nameBySlug.get(m[1]) ?? m[1];
    return `<${m[2]}> ${Number(m[3]) + 1} · ${scope}`;
  };

  const hoverSlug = hoverLine !== null ? lineMap[hoverLine] ?? null : null;
  const hoverName = hoverSlug
    ? labelFor(hoverSlug)
    : chipSlug
      ? labelFor(chipSlug)
      : null;

  const emitHover = (slug: string | null) => {
    if (slug !== lastSlug.current) {
      lastSlug.current = slug;
      onHoverLayer(slug);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const pre = preRef.current;
    if (!pre) return;
    const rect = pre.getBoundingClientRect();
    const y = e.clientY - rect.top + pre.scrollTop - PRE_PADDING;
    const line = Math.floor(y / LINE_HEIGHT);
    if (line >= 0 && line < lineMap.length) {
      setHoverLine(line);
      emitHover(lineMap[line]);
    } else {
      setHoverLine(null);
      emitHover(null);
    }
  };

  const onMouseLeave = () => {
    setHoverLine(null);
    emitHover(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. non-secure context); select-all fallback
      // is left to the user.
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
        {files.map((f, i) => (
          <button
            key={f.name}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
              i === active
                ? "bg-neutral-100 text-sky-700 dark:bg-neutral-800 dark:text-sky-300"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {f.name}
          </button>
        ))}
        {hoverName && (
          <span className="ml-1 truncate rounded bg-sky-100 px-2 py-0.5 font-mono text-[11px] text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            ◈ {hoverName}
          </span>
        )}
        <button
          type="button"
          onClick={copy}
          className={`ml-auto rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
            copied
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          }`}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      {truncated && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          Large output — showing the first {Math.round(MAX_RENDERED_CHARS / 1000)} KB of{" "}
          {Math.round(file.code.length / 1024)} KB. <strong>Copy</strong> gives you the complete
          file.
        </div>
      )}
      <pre
        ref={preRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="relative min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-[18px] text-neutral-800 dark:text-neutral-200"
      >
        {hoverLine !== null && hoverSlug && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 min-w-full bg-sky-100/70 dark:bg-sky-400/10"
            style={{ top: PRE_PADDING + hoverLine * LINE_HEIGHT, height: LINE_HEIGHT }}
          />
        )}
        {highlightRanges.map(([start, end]) => (
          <div
            key={`${start}-${end}`}
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 min-w-full border-l-2 border-sky-500 bg-sky-200/60 dark:bg-sky-400/20"
            style={{
              top: PRE_PADDING + start * LINE_HEIGHT,
              height: (end - start + 1) * LINE_HEIGHT,
            }}
          />
        ))}
        <code className="relative">{shown}</code>
      </pre>
    </div>
  );
}
