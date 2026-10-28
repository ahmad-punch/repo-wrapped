import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

interface Author {
  name: string;
  email: string;
}

export const ADA: Author = { name: "Ada Lovelace", email: "ada@example.com" };
export const GRACE: Author = { name: "Grace Hopper", email: "grace@example.com" };

export interface Fixture {
  dir: string;
  cleanup: () => void;
}

/** A scratch directory whose repo is always called `demo-repo`, so output is stable. */
export function scratchDir(): Fixture {
  const base = mkdtempSync(join(tmpdir(), "repo-wrapped-"));
  const dir = join(base, "demo-repo");
  mkdirSync(dir);
  return { dir, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function git(dir: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
  return execFileSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      ...env,
    },
  });
}

function write(dir: string, path: string, lines: number, prefix = "line"): void {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  const body = Array.from({ length: lines }, (_, i) => `${prefix} ${i + 1}`).join("\n");
  writeFileSync(full, `${body}\n`);
}

function commit(dir: string, author: Author, date: string, message: string): void {
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "--quiet", "--allow-empty", "-m", message], {
    GIT_AUTHOR_NAME: author.name,
    GIT_AUTHOR_EMAIL: author.email,
    GIT_COMMITTER_NAME: author.name,
    GIT_COMMITTER_EMAIL: author.email,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
}

export function initRepo(dir: string, userEmail = ADA.email): void {
  git(dir, ["init", "--quiet", "-b", "main"]);
  git(dir, ["config", "user.name", "Fixture"]);
  git(dir, ["config", "user.email", userEmail]);
  git(dir, ["config", "commit.gpgsign", "false"]);
}

/**
 * Eight scripted commits with fixed dates in UTC. Ada works late nights,
 * Grace pairs once and lands one feature, and a merge and a revert close it out.
 */
export function buildFixtureRepo(): Fixture {
  const fixture = scratchDir();
  const { dir } = fixture;
  initRepo(dir);

  write(dir, "src/parse.ts", 40);
  commit(dir, ADA, "2026-01-05T23:15:00+00:00", "feat: initial log parser");

  write(dir, "src/parse.ts", 44);
  commit(dir, ADA, "2026-01-06T23:40:00+00:00", "fix(parser): handle empty input");

  write(dir, "README.md", 12, "readme");
  commit(dir, ADA, "2026-01-07T01:10:00+00:00", "wip: fix typo in readme \u{1F389}");

  write(dir, "docs/usage.md", 20, "usage");
  commit(
    dir,
    ADA,
    "2026-01-07T22:45:00+00:00",
    "docs: explain usage\n\nCo-authored-by: Grace Hopper <grace@example.com>",
  );

  git(dir, ["checkout", "--quiet", "-b", "stats"]);
  write(dir, "src/stats.ts", 80, "stat");
  commit(dir, GRACE, "2026-01-12T10:00:00+00:00", "feat: add stats module");
  git(dir, ["checkout", "--quiet", "main"]);
  git(dir, ["merge", "--quiet", "--no-ff", "stats", "-m", "Merge branch 'stats'"], {
    GIT_AUTHOR_NAME: ADA.name,
    GIT_AUTHOR_EMAIL: ADA.email,
    GIT_COMMITTER_NAME: ADA.name,
    GIT_COMMITTER_EMAIL: ADA.email,
    GIT_AUTHOR_DATE: "2026-01-12T23:05:00+00:00",
    GIT_COMMITTER_DATE: "2026-01-12T23:05:00+00:00",
  });

  rmSync(join(dir, "src/stats.ts"));
  commit(dir, ADA, "2026-01-13T00:30:00+00:00", 'Revert "feat: add stats module"');

  write(dir, "src/parse.ts", 30);
  commit(dir, ADA, "2026-01-13T23:50:00+00:00", "refactor(parser): oops, trim dead branches");

  return fixture;
}
