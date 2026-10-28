import type { Commit, FileChange } from "./types.js";

const RECORD = "\x1e";
const FIELD = "\x1f";

/**
 * The `--format` string handed to `git log`. Each commit starts with a record
 * separator and its fields are split by unit separators, so multi-line commit
 * bodies never collide with the `--numstat` lines that follow them.
 */
export const LOG_FORMAT = "%x1e%H%x1f%P%x1f%aN%x1f%aE%x1f%aI%x1f%B%x1f";

export interface LogParser {
  write(chunk: string): void;
  end(): void;
}

/** Incremental parser: feed it stdout chunks, it calls `onCommit` per commit. */
export function createLogParser(onCommit: (commit: Commit) => void): LogParser {
  let buffer = "";
  return {
    write(chunk) {
      buffer += chunk;
      const lastStart = buffer.lastIndexOf(RECORD);
      if (lastStart <= 0) return;
      const complete = buffer.slice(0, lastStart);
      buffer = buffer.slice(lastStart);
      emitRecords(complete, onCommit);
    },
    end() {
      emitRecords(buffer, onCommit);
      buffer = "";
    },
  };
}

function emitRecords(text: string, onCommit: (commit: Commit) => void): void {
  for (const record of text.split(RECORD)) {
    if (record.trim() === "") continue;
    const commit = parseRecord(record);
    if (commit) onCommit(commit);
  }
}

export function parseRecord(record: string): Commit | null {
  const parts = record.split(FIELD);
  if (parts.length < 7) return null;
  const [hash, parents, authorName, authorEmail, authorDate, message, ...rest] = parts;
  if (!hash || !authorDate) return null;
  return {
    hash: hash.trim(),
    parents: parents ? parents.trim().split(" ").filter(Boolean) : [],
    authorName: authorName ?? "",
    authorEmail: authorEmail ?? "",
    authorDate,
    message: (message ?? "").trim(),
    files: parseNumstat(rest.join(FIELD)),
  };
}

const NUMSTAT_LINE = /^(\d+|-)\t(\d+|-)\t(.+)$/;

export function parseNumstat(text: string): FileChange[] {
  const files: FileChange[] = [];
  for (const line of text.split("\n")) {
    const match = NUMSTAT_LINE.exec(line.replace(/\r$/, ""));
    if (!match) continue;
    const [, added, deleted, rawPath] = match;
    const binary = added === "-" || deleted === "-";
    files.push({
      path: resolveRenamedPath(unquotePath(rawPath!)),
      added: binary ? 0 : Number(added),
      deleted: binary ? 0 : Number(deleted),
      binary,
    });
  }
  return files;
}

/**
 * Turns git's rename notation into the destination path:
 * `src/{old => new}/a.ts` becomes `src/new/a.ts`, `a.ts => b.ts` becomes `b.ts`.
 */
export function resolveRenamedPath(path: string): string {
  const braced = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(path);
  if (braced) {
    const [, prefix, , to, suffix] = braced;
    return `${prefix}${to}${suffix}`.replace(/\/{2,}/g, "/").replace(/^\//, "");
  }
  const arrow = path.indexOf(" => ");
  return arrow === -1 ? path : path.slice(arrow + 4);
}

function unquotePath(path: string): string {
  if (!(path.startsWith('"') && path.endsWith('"'))) return path;
  return path
    .slice(1, -1)
    .replace(/\\([\\"tn])/g, (_, ch: string) => (ch === "t" ? "\t" : ch === "n" ? "\n" : ch));
}
