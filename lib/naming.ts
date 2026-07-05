/**
 * Converts design-tool layer names (carried in SVG `id` attributes) into
 * identifiers usable as CSS classes, data-slots and component names.
 */

/** "CTA Button / Primary_2" -> "cta-button-primary-2" */
export function kebab(name: string): string | null {
  const cleaned = name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // split camelCase words
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (!cleaned) return null;
  return /^[0-9]/.test(cleaned) ? `n-${cleaned}` : cleaned;
}

/** "cta-button-primary" -> "CtaButtonPrimary" */
export function pascal(name: string): string | null {
  const k = kebab(name);
  if (!k) return null;
  return k
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Returns a function that appends -2, -3… to keep generated names unique. */
export function makeUnique(separator = "-"): (base: string) => string {
  const seen = new Map<string, number>();
  return (base: string) => {
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}${separator}${count + 1}`;
  };
}
