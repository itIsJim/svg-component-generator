"use client";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
      <span className="hidden lg:inline">{label}</span>
      <span className="flex rounded-lg border border-neutral-300 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              opt.value === value
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </span>
    </label>
  );
}
