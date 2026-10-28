import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main, type Io } from "../src/main.js";
import { renderSvg } from "../src/render/svg.js";
import { visibleWidth } from "../src/render/text.js";
import type { WrappedStats } from "../src/stats.js";
import { collectStats } from "../src/wrap.js";
import { buildFixtureRepo, initRepo, scratchDir, type Fixture } from "./fixture.js";

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

async function run(argv: string[], env: NodeJS.ProcessEnv = {}, isTTY = false): Promise<Run> {
  let stdout = "";
  let stderr = "";
  const io: Io = {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    env,
    isTTY,
  };
  const code = await main(argv, io);
  return { code, stdout, stderr };
}

let repo: Fixture;

beforeAll(() => {
  repo = buildFixtureRepo();
});

afterAll(() => repo.cleanup());

describe("--json", () => {
  let stats: WrappedStats;

  beforeAll(async () => {
    const result = await run([repo.dir, "--json", "--all-authors"]);
    expect(result.code).toBe(0);
    stats = JSON.parse(result.stdout) as WrappedStats;
  });

  it("counts commits, merges, reverts and lines", () => {
    expect(stats.totals).toEqual({
      commits: 8,
      merges: 1,
      reverts: 1,
      activeDays: 5,
      linesAdded: 156,
      linesDeleted: 94,
      filesTouched: 4,
    });
  });

  it("finds streaks, gaps and the busiest day", () => {
    expect(stats.streaks.longest).toEqual({ days: 3, start: "2026-01-05", end: "2026-01-07" });
    expect(stats.streaks.longestGap).toEqual({ days: 4, start: "2026-01-07", end: "2026-01-12" });
    expect(stats.streaks.busiestDay).toEqual({ date: "2026-01-07", commits: 2 });
  });

  it("buckets commits by the author's local hour and weekday", () => {
    expect(stats.time.byHour[23]).toBe(4);
    expect(stats.time.byHour[10]).toBe(1);
    expect(stats.time.byWeekday).toEqual([3, 3, 2, 0, 0, 0, 0]);
    expect(stats.time.persona).toBe("Night owl");
  });

  it("ranks files, directories and languages", () => {
    expect(stats.files.top[0]).toEqual({ name: "src/parse.ts", commits: 3, lines: 58 });
    expect(stats.files.topDirectories.map((dir) => dir.name)).toEqual(["src", "docs", "(root)"]);
    expect(stats.files.languages.map((lang) => lang.name)).toEqual(["TypeScript", "Markdown"]);
  });

  it("reads commit messages for style, confessions and emoji", () => {
    expect(stats.messages.conventionalTypes[0]).toEqual({ type: "feat", count: 2 });
    expect([stats.messages.wip, stats.messages.typo, stats.messages.oops]).toEqual([1, 1, 1]);
    expect(stats.messages.topEmoji).toEqual([{ emoji: "\u{1F389}", count: 1 }]);
    expect(stats.messages.topWords.map((entry) => entry.word)).not.toContain("feat");
  });

  it("builds a leaderboard, bus factor and co-author list", () => {
    expect(stats.collaboration.authors.map((a) => [a.name, a.commits])).toEqual([
      ["Ada Lovelace", 7],
      ["Grace Hopper", 1],
    ]);
    expect(stats.collaboration.busFactor).toBe(1);
    expect(stats.collaboration.coAuthors.map((a) => a.name)).toEqual(["Grace Hopper"]);
  });

  it("gives a deterministic personality label", () => {
    expect(stats.personality.label).toBe("The Midnight Librarian");
  });
});

describe("terminal cards", () => {
  it("defaults to the repo's git user and draws aligned boxes without colour", async () => {
    const result = await run([repo.dir], { NO_COLOR: "1" }, true);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("commits by ada@example.com");
    expect(result.stdout).not.toContain("\x1b[");
    const widths = new Set(
      result.stdout
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => visibleWidth(line)),
    );
    expect([...widths]).toEqual([64]);
  });

  it("uses colour on a TTY unless --no-color is passed", async () => {
    const coloured = await run([repo.dir], {}, true);
    const plain = await run([repo.dir, "--no-color"], {}, true);
    expect(coloured.stdout).toContain("\x1b[");
    expect(plain.stdout).not.toContain("\x1b[");
  });

  it("shows the team card with --all-authors", async () => {
    const result = await run([repo.dir, "--all-authors", "--no-color"]);
    expect(result.stdout).toContain("THE TEAM");
    expect(result.stdout).toContain("Bus factor 1");
  });

  it("filters by --author and date range", async () => {
    const result = await run([repo.dir, "--json", "--author", "Grace", "--since", "2026-01-10"]);
    expect((JSON.parse(result.stdout) as WrappedStats).totals.commits).toBe(1);
  });
});

describe("exports", () => {
  it("renders a stable 1200x630 SVG card with no external resources", async () => {
    const stats = await collectStats({ path: repo.dir, allAuthors: true, top: 5 });
    const svg = renderSvg(stats);
    expect(svg).toMatch(/^<svg[^>]+width="1200" height="630"/);
    expect(svg).not.toMatch(/@import|<link|href="http|@font-face/);
    await expect(svg).toMatchFileSnapshot("__snapshots__/fixture-card.svg");
  });

  it("writes the SVG and Markdown files it was asked for", async () => {
    const svgPath = join(repo.dir, "..", "card.svg");
    const mdPath = join(repo.dir, "..", "wrapped.md");
    const result = await run([repo.dir, "--svg", svgPath, "--md", mdPath, "--no-color"]);
    expect(result.code).toBe(0);
    expect(await readFile(svgPath, "utf8")).toContain("<svg");
    expect(await readFile(mdPath, "utf8")).toContain("demo-repo");
  });
});

describe("friendly errors", () => {
  it("explains when the path is not a git repository", async () => {
    const empty = scratchDir();
    const result = await run([empty.dir]);
    empty.cleanup();
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/is not inside a git repository/);
  });

  it("explains when the repository has no commits", async () => {
    const empty = scratchDir();
    initRepo(empty.dir);
    const result = await run([empty.dir]);
    empty.cleanup();
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/has no commits yet/);
  });

  it("suggests --all-authors when the default author has no commits", async () => {
    const result = await run([repo.dir, "--author", "nobody-here"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/No commits found by nobody-here/);
  });

  it("names a missing branch", async () => {
    const result = await run([repo.dir, "--branch", "does-not-exist"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/Branch "does-not-exist" was not found/);
  });
});
