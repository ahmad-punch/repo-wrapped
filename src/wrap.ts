import { UserError } from "./errors.js";
import { currentUserEmail, inspectRepo, streamCommits } from "./git.js";
import { StatsCollector, type WrappedStats } from "./stats.js";

export interface WrapOptions {
  path: string;
  since?: string;
  until?: string;
  year?: string;
  author?: string;
  allAuthors: boolean;
  branch?: string;
  top: number;
}

/** Turns CLI options into finished stats, reading the log exactly once. */
export async function collectStats(options: WrapOptions): Promise<WrappedStats> {
  const repo = await inspectRepo(options.path);
  if (!repo.hasCommits) {
    throw new UserError(`${repo.name} has no commits yet. Make your first commit, then come back for your wrap.`);
  }
  const range = dateRange(options);
  const author = await resolveAuthor(options, repo.root);
  const collector = new StatsCollector();
  await streamCommits(
    repo.root,
    {
      ...range,
      ...(author.pattern ? { author: author.pattern } : {}),
      ...(options.branch ? { branch: options.branch } : {}),
    },
    (commit) => collector.add(commit),
  );
  const stats = collector.finish({
    repo: { name: repo.name, path: repo.root, branch: options.branch ?? "HEAD" },
    filters: {
      since: range.since ?? null,
      until: range.until ?? null,
      author: author.label,
      allAuthors: options.allAuthors,
    },
    top: options.top,
    ...(options.year ? { year: options.year } : {}),
  });
  if (stats.totals.commits === 0) throw new UserError(emptyRangeMessage(options, author.label));
  return stats;
}

function dateRange(options: WrapOptions): { since?: string; until?: string } {
  if (options.year) {
    if (options.since || options.until) {
      throw new UserError("Use either --year or --since/--until, not both.");
    }
    if (!/^\d{4}$/.test(options.year)) {
      throw new UserError(`--year expects a four-digit year such as 2026, got "${options.year}".`);
    }
    return { since: `${options.year}-01-01T00:00:00`, until: `${options.year}-12-31T23:59:59` };
  }
  return {
    ...(options.since ? { since: options.since } : {}),
    ...(options.until ? { until: options.until } : {}),
  };
}

interface AuthorFilter {
  pattern: string | null;
  label: string | null;
}

/**
 * An explicit --author always wins. Otherwise the wrap is personal: it uses
 * the repo's git user.email, unless --all-authors asks for the whole team.
 */
async function resolveAuthor(options: WrapOptions, root: string): Promise<AuthorFilter> {
  if (options.author) return { pattern: options.author, label: options.author };
  if (options.allAuthors) return { pattern: null, label: null };
  const email = await currentUserEmail(root);
  if (!email) return { pattern: null, label: null };
  return { pattern: `<${escapeRegex(email)}>`, label: email };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emptyRangeMessage(options: WrapOptions, author: string | null): string {
  const filters = [
    author ? `by ${author}` : null,
    options.year ? `in ${options.year}` : null,
    options.since ? `since ${options.since}` : null,
    options.until ? `until ${options.until}` : null,
    options.branch ? `on ${options.branch}` : null,
  ].filter(Boolean);
  const hint = author && !options.author
    ? "Try --all-authors to wrap everyone, or --author <name-or-email>."
    : "Try widening --since/--until or dropping --author.";
  return `No commits found ${filters.join(" ")}. ${hint}`;
}
