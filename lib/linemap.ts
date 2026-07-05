import { pascal } from "./naming";

/**
 * Maps each line of a generated file to a stable element key so the app can
 * link code and preview in both directions, down to individual elements.
 *
 * Keys mirror lib/decorate.ts: named layers use their slug; unnamed elements
 * get "<scope>/<tag>~<n>" where scope is the nearest named ancestor and n
 * counts same-tag occurrences inside that scope in document order. Counters
 * reset per named scope, which keeps the keys stable even though React
 * output reorders named groups into subcomponent functions.
 *
 * Works on the disciplined output of our own emitters (one tag per line, or
 * a multi-line attribute block ending in ">" / "/>") across JSX, Vue and
 * Angular templates, plus SCSS rule blocks.
 */

interface Scope {
  slug: string;
  counters: Map<string, number>;
}

interface Entry {
  key: string | null;
  scope: Scope;
  inDefs: boolean;
}

export function buildLineMap(code: string, slugs: string[]): (string | null)[] {
  const slugSet = new Set(slugs);
  const byPascal = new Map<string, string>();
  for (const slug of slugs) {
    const p = pascal(slug);
    if (p && !byPascal.has(p)) byPascal.set(p, slug);
  }

  /** Exact Pascal lookup, then with the dedupe digit suffix stripped
      (a "PricingCard" group next to the PricingCard component emits
      a subcomponent named PricingCard2). */
  const pascalSlug = (name: string): string | null =>
    byPascal.get(name) ?? byPascal.get(name.replace(/\d+$/, "")) ?? null;

  /** SFC structure tags that exist in code but never in the artwork. */
  const NON_ELEMENT_TAGS = new Set(["template", "script", "style"]);

  const slugFrom = (text: string): string | null => {
    const classAttr = text.match(/(?:className|class)="([^"]*)"/);
    if (classAttr) {
      for (const token of classAttr[1].split(/\s+/)) {
        if (slugSet.has(token)) return token;
      }
    }
    const slot = text.match(/data-slot="([^"]+)"/);
    if (slot && slugSet.has(slot[1])) return slot[1];
    return null;
  };

  const lines = code.split("\n");
  const map: (string | null)[] = new Array(lines.length).fill(null);

  const rootScope: Scope = { slug: "~root", counters: new Map() };
  const stack: Entry[] = [];
  const cur = (): Entry =>
    stack[stack.length - 1] ?? { key: null, scope: rootScope, inDefs: false };

  /** Resolves the key + child scope for an element opened with `text`. */
  const openElement = (
    tag: string,
    text: string
  ): { key: string | null; childScope: Scope; inDefs: boolean } => {
    const parent = cur();
    if (parent.inDefs || tag === "defs") {
      return { key: null, childScope: parent.scope, inDefs: true };
    }
    if (NON_ELEMENT_TAGS.has(tag)) {
      return { key: null, childScope: parent.scope, inDefs: false };
    }
    // <svg> only occurs at the root; its scss-mode component class must not
    // be mistaken for a layer slug (see lib/decorate.ts elKey).
    const slug = tag === "svg" ? null : slugFrom(text);
    if (slug) {
      return { key: slug, childScope: { slug, counters: new Map() }, inDefs: false };
    }
    const n = parent.scope.counters.get(tag) ?? 0;
    parent.scope.counters.set(tag, n + 1);
    return {
      key: `${parent.scope.slug}/${tag}~${n}`,
      childScope: parent.scope,
      inDefs: false,
    };
  };

  /** Open tag currently being collected across multiple attribute lines. */
  let open: { tag: string; text: string; lineIndexes: number[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (open) {
      open.lineIndexes.push(i);
      open.text += " " + trimmed;
      if (trimmed.endsWith("/>") || trimmed.endsWith(">")) {
        const { key, childScope, inDefs } = openElement(open.tag, open.text);
        for (const idx of open.lineIndexes) map[idx] = key;
        const staysOpen =
          trimmed.endsWith(">") && !trimmed.endsWith("/>") && !trimmed.includes("</");
        if (staysOpen) stack.push({ key, scope: childScope, inDefs });
        open = null;
      }
      continue;
    }

    // SCSS rules (.slug { … }) — also covers <style> blocks in Vue SFCs.
    const scssOpen = trimmed.match(/^\.([a-z0-9-]+)\s*\{$/);
    if (scssOpen) {
      const slug = slugSet.has(scssOpen[1]) ? scssOpen[1] : cur().key;
      map[i] = slug;
      stack.push({
        key: slug,
        scope: { slug: slug ?? "~root", counters: new Map() },
        inDefs: false,
      });
      continue;
    }
    if (trimmed === "}" && stack.length > 0) {
      map[i] = cur().key;
      stack.pop();
      continue;
    }

    if (trimmed.startsWith("</")) {
      map[i] = cur().key;
      stack.pop();
      continue;
    }

    // React subcomponent references and definitions (<CtaButton />, function CtaButton()).
    const sub =
      trimmed.match(/^<([A-Z][A-Za-z0-9]*)\s*\/>$/) ??
      trimmed.match(/^function ([A-Z][A-Za-z0-9]*)\(/);
    if (sub) {
      map[i] = pascalSlug(sub[1]) ?? cur().key;
      continue;
    }

    const tagMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
    if (tagMatch && !trimmed.startsWith("<!--")) {
      const tag = tagMatch[1];
      if (/^[A-Z]/.test(tag)) {
        // JSX component reference with attributes — never an svg element.
        map[i] = pascalSlug(tag) ?? cur().key;
        continue;
      }
      if (trimmed.endsWith("/>")) {
        map[i] = openElement(tag, trimmed).key;
      } else if (trimmed.endsWith(">") || trimmed.includes("</")) {
        const { key, childScope, inDefs } = openElement(tag, trimmed);
        map[i] = key;
        if (!trimmed.includes("</") && trimmed.endsWith(">")) {
          stack.push({ key, scope: childScope, inDefs });
        }
      } else {
        open = { tag, text: trimmed, lineIndexes: [i] };
      }
      continue;
    }

    map[i] = cur().key;
  }

  return map;
}
