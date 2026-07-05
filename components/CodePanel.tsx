"use client";

import { useState } from "react";
import { GeneratedFile } from "@/lib/generate";

const MAX_RENDERED_CHARS = 150_000;

export function CodePanel({ files }: { files: GeneratedFile[] }) {
  // The parent remounts this panel (via key) when framework/styling change,
  // so `active` only needs clamping for edits that shrink the file list.
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const file = files[Math.min(active, files.length - 1)];
  if (!file) return null;

  // Rendering megabytes of text into the DOM freezes the tab; cap the view.
  // Copy always uses the full file.
  const truncated = file.code.length > MAX_RENDERED_CHARS;
  const shown = truncated
    ? file.code.slice(0, file.code.lastIndexOf("\n", MAX_RENDERED_CHARS))
    : file.code;

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
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-neutral-800 dark:text-neutral-200">
        <code>{shown}</code>
      </pre>
    </div>
  );
}
