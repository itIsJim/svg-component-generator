/**
 * Minimal, dependency-free XML parser tuned for SVG documents exported by
 * design tools. Such exports are well-formed XML (quoted attributes, properly
 * nested tags), so we don't need namespaces resolution, DTD handling, etc.
 */

export interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: XmlChild[];
}

export type XmlChild = XmlElement | { text: string };

export function isElement(child: XmlChild): child is XmlElement {
  return (child as XmlElement).tag !== undefined;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = parseInt(body.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (body.startsWith("#")) {
      const code = parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

export class XmlParseError extends Error {
  constructor(message: string, public position: number) {
    super(message);
    this.name = "XmlParseError";
  }
}

const TAG_NAME = /[A-Za-z_][A-Za-z0-9_:.-]*/y;
const ATTR_NAME = /[A-Za-z_][A-Za-z0-9_:.-]*/y;
const WS = /[ \t\r\n]*/y;

/** Parses an XML string and returns the first root element found. */
export function parseXml(input: string): XmlElement {
  let pos = 0;

  const fail = (message: string): never => {
    throw new XmlParseError(`${message} (at offset ${pos})`, pos);
  };

  const skipWs = () => {
    WS.lastIndex = pos;
    const m = WS.exec(input);
    if (m) pos = WS.lastIndex;
  };

  const readName = (re: RegExp): string => {
    re.lastIndex = pos;
    const m = re.exec(input);
    if (!m) fail("Expected a name");
    pos = re.lastIndex;
    return m![0];
  };

  const readAttrs = (): Record<string, string> => {
    const attrs: Record<string, string> = {};
    for (;;) {
      skipWs();
      const ch = input[pos];
      if (ch === ">" || ch === "/" || ch === undefined) return attrs;
      const name = readName(ATTR_NAME);
      skipWs();
      if (input[pos] !== "=") {
        attrs[name] = ""; // boolean attribute (rare in SVG, but tolerate)
        continue;
      }
      pos++; // '='
      skipWs();
      const quote = input[pos];
      if (quote !== '"' && quote !== "'") fail(`Attribute "${name}" is missing quotes`);
      const end = input.indexOf(quote!, pos + 1);
      if (end === -1) fail(`Unterminated value for attribute "${name}"`);
      attrs[name] = decodeEntities(input.slice(pos + 1, end));
      pos = end + 1;
    }
  };

  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  let textStart = -1;

  const flushText = () => {
    if (textStart === -1) return;
    const raw = input.slice(textStart, pos);
    textStart = -1;
    if (raw.trim() === "" || stack.length === 0) return;
    stack[stack.length - 1].children.push({ text: decodeEntities(raw) });
  };

  while (pos < input.length) {
    if (input[pos] !== "<") {
      if (textStart === -1) textStart = pos;
      pos++;
      continue;
    }
    flushText();

    if (input.startsWith("<!--", pos)) {
      const end = input.indexOf("-->", pos + 4);
      if (end === -1) fail("Unterminated comment");
      pos = end + 3;
      continue;
    }
    if (input.startsWith("<![CDATA[", pos)) {
      const end = input.indexOf("]]>", pos + 9);
      if (end === -1) fail("Unterminated CDATA section");
      if (stack.length > 0) {
        stack[stack.length - 1].children.push({ text: input.slice(pos + 9, end) });
      }
      pos = end + 3;
      continue;
    }
    if (input.startsWith("<?", pos) || input.startsWith("<!", pos)) {
      const end = input.indexOf(">", pos);
      if (end === -1) fail("Unterminated declaration");
      pos = end + 1;
      continue;
    }
    if (input.startsWith("</", pos)) {
      pos += 2;
      const tag = readName(TAG_NAME);
      skipWs();
      if (input[pos] !== ">") fail(`Malformed closing tag </${tag}`);
      pos++;
      const open = stack.pop();
      if (!open || open.tag !== tag) {
        fail(`Closing tag </${tag}> does not match <${open?.tag ?? "nothing"}>`);
      }
      continue;
    }

    // Opening tag
    pos++;
    const tag = readName(TAG_NAME);
    const attrs = readAttrs();
    const el: XmlElement = { tag, attrs, children: [] };

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(el);
    } else if (!root) {
      root = el;
    }

    if (input.startsWith("/>", pos)) {
      pos += 2;
    } else if (input[pos] === ">") {
      pos++;
      stack.push(el);
    } else {
      fail(`Malformed tag <${tag}>`);
    }

    if (root && stack.length === 0 && root === el && tag !== "svg") {
      // keep scanning; the svg root may come after e.g. a stray element
    }
  }
  flushText();

  if (stack.length > 0) fail(`Unclosed tag <${stack[stack.length - 1].tag}>`);
  if (!root) fail("No XML element found in input");
  return root!;
}

/** Finds the first <svg> element (the root itself or a descendant). */
export function findSvgRoot(el: XmlElement): XmlElement | null {
  if (el.tag === "svg") return el;
  for (const child of el.children) {
    if (isElement(child)) {
      const found = findSvgRoot(child);
      if (found) return found;
    }
  }
  return null;
}
