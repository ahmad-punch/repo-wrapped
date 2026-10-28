export const CONVENTIONAL =
  /^(feat|fix|docs|style|refactor|perf|test|tests|build|ci|chore|revert)(\([^)]*\))?!?:\s/i;

const TRAILER = /^[A-Za-z][A-Za-z-]*:\s.+$/;
const CO_AUTHOR = /^co-authored-by:\s*(.+?)\s*<([^>]+)>\s*$/gim;
const WORD = /[a-z][a-z0-9'-]*[a-z0-9]/g;
const EMOJI = /\p{Extended_Pictographic}(️)?/gu;
const SHORTCODE = /(?<=^|\s):[a-z0-9_+-]+:(?=\s|$)/g;

const STOP_WORDS = new Set(
  (
    "the a an and or but if then else for to of in on at by with from into onto over under " +
    "is are was were be been being am do does did done has have had having it its it's this that " +
    "these those there here as so not no yes can could should would will just also too very " +
    "add adds added update updates updated use uses used make makes made set get new more some " +
    "all any via per when while after before now up out off than only about our your their " +
    "his her them they you we i me my mine us one two etc wip " +
    "feat fix docs style refactor perf test tests build chore revert merge branch"
  ).split(/\s+/),
);

export interface CoAuthor {
  name: string;
  email: string;
}

export function subjectOf(message: string): string {
  const newline = message.indexOf("\n");
  return (newline === -1 ? message : message.slice(0, newline)).trim();
}

/** Message text without trailers such as `Signed-off-by:` or `Co-authored-by:`. */
export function proseOf(message: string): string {
  const [subject = "", ...body] = message.split("\n");
  return [subject, ...body.filter((line) => !TRAILER.test(line.trim()))].join("\n");
}

export function coAuthorsOf(message: string): CoAuthor[] {
  const found: CoAuthor[] = [];
  for (const match of message.matchAll(CO_AUTHOR)) {
    found.push({ name: match[1]!.trim(), email: match[2]!.trim().toLowerCase() });
  }
  return found;
}

export function conventionalTypeOf(subject: string): string | null {
  const match = CONVENTIONAL.exec(subject);
  return match ? match[1]!.toLowerCase().replace(/^tests$/, "test") : null;
}

export function wordsOf(message: string): string[] {
  const text = proseOf(message).toLowerCase().replace(CONVENTIONAL, "");
  return (text.match(WORD) ?? []).filter(
    (word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d/.test(word),
  );
}

export function emojiOf(message: string): string[] {
  const glyphs = [...message.matchAll(EMOJI)]
    .map((match) => match[0].replace("️", ""))
    .filter((glyph) => glyph.codePointAt(0)! >= 0x2300);
  const codes = subjectOf(message).match(SHORTCODE) ?? [];
  return [...glyphs, ...codes];
}

export function isRevert(subject: string): boolean {
  return /^revert[\s:("]/i.test(subject);
}

export interface Oopsies {
  wip: boolean;
  typo: boolean;
  oops: boolean;
}

export function oopsiesOf(subject: string): Oopsies {
  return {
    wip: /\bwip\b|work in progress/i.test(subject),
    typo: /\btypos?\b/i.test(subject),
    oops: /\b(oops+|whoops|my bad|forgot)\b|^(fixup|squash)!/i.test(subject),
  };
}
