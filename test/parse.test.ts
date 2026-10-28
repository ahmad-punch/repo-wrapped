import { describe, expect, it } from "vitest";
import { createLogParser, parseNumstat, resolveRenamedPath } from "../src/parse.js";
import type { Commit } from "../src/types.js";

const RS = "\x1e";
const US = "\x1f";

function record(hash: string, message: string, numstat: string): string {
  return `${RS}${hash}${US}parent1${US}Ada${US}ada@example.com${US}2026-01-05T23:15:00+00:00${US}${message}${US}\n${numstat}`;
}

describe("parseNumstat", () => {
  it("reads additions, deletions and binary files", () => {
    expect(parseNumstat("3\t1\tsrc/a.ts\n-\t-\tlogo.png\n")).toEqual([
      { path: "src/a.ts", added: 3, deleted: 1, binary: false },
      { path: "logo.png", added: 0, deleted: 0, binary: true },
    ]);
  });

  it("unquotes paths git escaped", () => {
    expect(parseNumstat('1\t0\t"dir/with\\"quote.ts"')[0]?.path).toBe('dir/with"quote.ts');
  });
});

describe("resolveRenamedPath", () => {
  it("follows braced and plain renames to the new path", () => {
    expect(resolveRenamedPath("src/{old => new}/a.ts")).toBe("src/new/a.ts");
    expect(resolveRenamedPath("src/{ => lib}/a.ts")).toBe("src/lib/a.ts");
    expect(resolveRenamedPath("a.ts => b.ts")).toBe("b.ts");
  });
});

describe("createLogParser", () => {
  it("emits the same commits however the stream is chunked", () => {
    const text =
      record("aaa", "feat: one\n\nbody line\n2\t2\tnot-numstat", "5\t0\tsrc/one.ts\n") +
      record("bbb", "fix: two", "1\t1\tsrc/two.ts\n");
    const whole: Commit[] = [];
    const wholeParser = createLogParser((c) => whole.push(c));
    wholeParser.write(text);
    wholeParser.end();

    const pieces: Commit[] = [];
    const pieceParser = createLogParser((c) => pieces.push(c));
    for (const char of text) pieceParser.write(char);
    pieceParser.end();

    expect(pieces).toEqual(whole);
    expect(whole.map((c) => c.hash)).toEqual(["aaa", "bbb"]);
    expect(whole[0]?.message).toBe("feat: one\n\nbody line\n2\t2\tnot-numstat");
    expect(whole[0]?.files).toEqual([{ path: "src/one.ts", added: 5, deleted: 0, binary: false }]);
  });
});
