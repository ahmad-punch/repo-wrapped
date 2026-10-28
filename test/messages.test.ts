import { describe, expect, it } from "vitest";
import { coAuthorsOf, conventionalTypeOf, emojiOf, oopsiesOf, wordsOf } from "../src/messages.js";
import { busFactor, longestGap, longestStreak, oneLiner } from "../src/stats.js";

describe("commit messages", () => {
  it("recognises conventional commit types", () => {
    expect(conventionalTypeOf("feat(cli)!: drop node 20")).toBe("feat");
    expect(conventionalTypeOf("tests: cover parser")).toBe("test");
    expect(conventionalTypeOf("Update README")).toBeNull();
  });

  it("reads co-authors from trailers", () => {
    expect(coAuthorsOf("fix: x\n\nCo-authored-by: Grace Hopper <Grace@Example.com>")).toEqual([
      { name: "Grace Hopper", email: "grace@example.com" },
    ]);
  });

  it("drops stop-words, trailers and type prefixes from the vocabulary", () => {
    expect(wordsOf("feat: add the parser for streaming logs\n\nSigned-off-by: A <a@b.c>")).toEqual([
      "parser",
      "streaming",
      "logs",
    ]);
  });

  it("counts real emoji and gitmoji shortcodes, not CSS selectors", () => {
    expect(emojiOf(":sparkles: add confetti \u{1F389}")).toEqual(["\u{1F389}", ":sparkles:"]);
    expect(emojiOf("fix: theme\n\nset vars on :root: now")).toEqual([]);
  });

  it("spots wip, typo and oops confessions", () => {
    expect(oopsiesOf("WIP fix typo, oops")).toEqual({ wip: true, typo: true, oops: true });
    expect(oopsiesOf("feat: add parser")).toEqual({ wip: false, typo: false, oops: false });
  });
});

describe("streaks and team stats", () => {
  const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10", "2026-01-11"];

  it("finds the longest run of consecutive days", () => {
    expect(longestStreak(days)).toEqual({ days: 3, start: "2026-01-01", end: "2026-01-03" });
  });

  it("counts the days off in the longest gap", () => {
    expect(longestGap(days)).toEqual({ days: 6, start: "2026-01-03", end: "2026-01-10" });
  });

  it("estimates the bus factor as the fewest people behind half the commits", () => {
    expect(busFactor([90, 5, 5])).toBe(1);
    expect(busFactor([30, 30, 20, 20])).toBe(2);
  });

  it("writes a grammatical one-liner", () => {
    const line = oneLiner({ commits: 11, activeDays: 8, streak: 11, language: "Go", persona: "Early bird" });
    expect(line).toMatch(/^11 commits across 8 active days, an 11-day best streak, mostly Go, /);
  });
});
