"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildPreviewDoc } from "@/lib/preview";

type Background = "grid" | "light" | "dark";

const BG_CLASS: Record<Background, string> = {
  grid: "bg-neutral-100 [background-image:repeating-conic-gradient(#e5e5e5_0%_25%,transparent_0%_50%)] [background-size:16px_16px]",
  light: "bg-white",
  dark: "bg-neutral-900",
};

interface SelectedLayer {
  name: string;
  tag: string;
}

interface PreviewPanelProps {
  html: string;
  css: string;
  /** Layer slug to outline (driven by hovering the generated code). */
  highlight?: string | null;
  /** Fired with the layer slug under the cursor inside the preview. */
  onHoverLayer?: (slug: string | null) => void;
  /** Fired with the layer slug when a layer is clicked in the preview. */
  onSelectLayer?: (slug: string | null) => void;
}

export function PreviewPanel({
  html,
  css,
  highlight = null,
  onHoverLayer,
  onSelectLayer,
}: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(1);
  const [bg, setBg] = useState<Background>("grid");
  const [selected, setSelected] = useState<SelectedLayer | null>(null);
  const highlightRef = useRef<string | null>(null);

  const doc = useMemo(() => buildPreviewDoc(html, css), [html, css]);

  const post = (message: object) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  };

  const syncFrame = (background: Background, scale: number) => {
    post({ type: "svg-preview:zoom", value: scale });
    post({ type: "svg-preview:fg", value: background === "dark" ? "#e5e7eb" : "#0f172a" });
    post({ type: "svg-preview:highlight", el: highlightRef.current });
  };

  useEffect(() => {
    syncFrame(bg, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bg, zoom]);

  useEffect(() => {
    highlightRef.current = highlight;
    post({ type: "svg-preview:highlight", el: highlight });
  }, [highlight]);

  const onHoverRef = useRef(onHoverLayer);
  const onSelectRef = useRef(onSelectLayer);
  useEffect(() => {
    onHoverRef.current = onHoverLayer;
    onSelectRef.current = onSelectLayer;
  }, [onHoverLayer, onSelectLayer]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "svg-preview:select") {
        setSelected(e.data.name ? { name: e.data.name, tag: e.data.tag } : null);
        onSelectRef.current?.(e.data.el ?? null);
      } else if (e.data?.type === "svg-preview:hover") {
        onHoverRef.current?.(e.data.el ?? null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-3 py-1.5 text-xs dark:border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <span>Zoom</span>
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-sky-500 dark:accent-sky-400"
          />
          <span className="w-10 font-mono text-neutral-600 dark:text-neutral-300">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex gap-1">
          {(Object.keys(BG_CLASS) as Background[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBg(b)}
              className={`rounded-md px-2 py-1 capitalize transition-colors ${
                b === bg
                  ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        <div className="ml-auto truncate font-mono text-neutral-500 dark:text-neutral-400">
          {selected ? (
            <>
              <span className="text-pink-600 dark:text-pink-400">{selected.name}</span>
              <span className="text-neutral-400 dark:text-neutral-600"> &lt;{selected.tag}&gt;</span>
            </>
          ) : (
            <span className="text-neutral-400 dark:text-neutral-600">hover a layer · click to select</span>
          )}
        </div>
      </div>
      <div className={`min-h-0 flex-1 overflow-hidden transition-colors ${BG_CLASS[bg]}`}>
        <iframe
          ref={iframeRef}
          title="Component preview"
          sandbox="allow-scripts"
          srcDoc={doc}
          onLoad={() => syncFrame(bg, zoom)}
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
