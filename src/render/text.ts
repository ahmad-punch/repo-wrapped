const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const ZERO_WIDTH = /^(?:\p{M}|\u200d|\ufe0e|\ufe0f)$/u;
const WIDE = /\p{Emoji_Presentation}/u;
const SPARKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

function charWidth(char: string): number {
  if (ZERO_WIDTH.test(char)) return 0;
  const code = char.codePointAt(0)!;
  if (WIDE.test(char) || isEastAsianWide(code)) return 2;
  return 1;
}

function isEastAsianWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}

/** Terminal columns a string occupies, ignoring colour codes. */
export function visibleWidth(text: string): number {
  let width = 0;
  for (const char of stripAnsi(text)) width += charWidth(char);
  return width;
}

/** Cuts plain text to `max` columns, ending with an ellipsis when shortened. */
export function fit(text: string, max: number): string {
  if (visibleWidth(text) <= max) return text;
  let out = "";
  let width = 0;
  for (const char of text) {
    const next = charWidth(char);
    if (width + next > max - 1) break;
    out += char;
    width += next;
  }
  return `${out}…`;
}

/** Cuts a path from the left so the file name stays visible. */
export function fitPath(path: string, max: number): string {
  if (visibleWidth(path) <= max) return path;
  return `…${[...path].slice(-(max - 1)).join("")}`;
}

export function padEnd(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

export function padStart(text: string, width: number): string {
  return " ".repeat(Math.max(0, width - visibleWidth(text))) + text;
}

export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && visibleWidth(line) + 1 + visibleWidth(word) > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** One block character per value, scaled to the largest value. Zero is a dot. */
export function sparkline(values: number[], repeat = 1): string {
  const max = Math.max(...values, 0);
  return values
    .map((value) => {
      if (value === 0 || max === 0) return "·".repeat(repeat);
      const level = Math.min(SPARKS.length - 1, Math.ceil((value / max) * SPARKS.length) - 1);
      return SPARKS[level]!.repeat(repeat);
    })
    .join("");
}

export function bar(value: number, max: number, width: number): string {
  if (max === 0 || value === 0) return "";
  return "█".repeat(Math.max(1, Math.round((value / max) * width)));
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
