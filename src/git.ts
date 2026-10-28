import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { UserError } from "./errors.js";
import { createLogParser, LOG_FORMAT } from "./parse.js";
import type { Commit, LogOptions } from "./types.js";

export interface RepoInfo {
  root: string;
  name: string;
  hasCommits: boolean;
}

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs git without a shell, so paths and patterns are never interpreted. */
function git(args: string[], cwd: string, onStdout?: (chunk: string) => void): Promise<GitResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_PAGER: "cat", LC_ALL: "C" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (onStdout) onStdout(chunk);
      else stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new UserError("git was not found on your PATH. Install git and try again."));
      } else {
        reject(error);
      }
    });
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout, stderr }));
  });
}

export async function inspectRepo(path: string): Promise<RepoInfo> {
  const absolute = resolve(path);
  if (!isDirectory(absolute)) {
    throw new UserError(`${absolute} is not a directory. Pass the path to a git repository.`);
  }
  const top = await git(["rev-parse", "--show-toplevel"], absolute);
  if (top.code !== 0) {
    throw new UserError(
      `${absolute} is not inside a git repository. Run repo-wrapped from a repo, or pass its path: repo-wrapped ~/code/my-project`,
    );
  }
  const root = top.stdout.trim();
  const head = await git(["rev-parse", "--verify", "--quiet", "HEAD"], absolute);
  return { root, name: basename(root), hasCommits: head.code === 0 };
}

export async function currentUserEmail(cwd: string): Promise<string | null> {
  const result = await git(["config", "user.email"], cwd);
  const email = result.stdout.trim();
  return result.code === 0 && email !== "" ? email : null;
}

export function buildLogArgs(options: LogOptions): string[] {
  const args = [
    "-c",
    "core.quotePath=false",
    "log",
    "--numstat",
    "--no-color",
    "--no-ext-diff",
    `--format=${LOG_FORMAT}`,
  ];
  if (options.since) args.push(`--since=${options.since}`);
  if (options.until) args.push(`--until=${options.until}`);
  if (options.author) args.push(`--author=${options.author}`);
  const branch = options.branch ?? "HEAD";
  if (branch.startsWith("-")) {
    throw new UserError(`"${branch}" is not a valid branch name.`);
  }
  args.push(branch, "--");
  return args;
}

/** Streams `git log` and hands each parsed commit to `onCommit` as it arrives. */
export async function streamCommits(
  cwd: string,
  options: LogOptions,
  onCommit: (commit: Commit) => void,
): Promise<void> {
  const parser = createLogParser(onCommit);
  const result = await git(buildLogArgs(options), cwd, (chunk) => parser.write(chunk));
  if (result.code !== 0) {
    throw new UserError(explainLogFailure(result.stderr, options));
  }
  parser.end();
}

function explainLogFailure(stderr: string, options: LogOptions): string {
  if (options.branch && /unknown revision|bad revision|ambiguous argument/.test(stderr)) {
    return `Branch "${options.branch}" was not found. List branches with: git branch -a`;
  }
  return `git log failed: ${stderr.trim() || "unknown error"}`;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
