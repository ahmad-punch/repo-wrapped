import { directoryOf, isGenerated, languageOf } from "./files.js";
import {
  coAuthorsOf,
  conventionalTypeOf,
  emojiOf,
  isRevert,
  oopsiesOf,
  subjectOf,
  wordsOf,
} from "./messages.js";
import {
  hourPersona,
  hourShares,
  oopsJoke,
  personality,
  PERSONA_PHRASES,
  workStyle,
  type HourPersona,
  type Personality,
  type WorkStyle,
} from "./persona.js";
import type { Commit } from "./types.js";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface CommitRef {
  hash: string;
  subject: string;
  lines: number;
  date: string;
}

export interface Ranked {
  name: string;
  commits: number;
  lines: number;
}

export interface Span {
  days: number;
  start: string;
  end: string;
}

export interface Person {
  name: string;
  email: string;
  commits: number;
  lines: number;
}

export interface WrappedStats {
  repo: { name: string; path: string; branch: string };
  filters: { since: string | null; until: string | null; author: string | null; allAuthors: boolean };
  period: { first: string | null; last: string | null; label: string };
  totals: {
    commits: number;
    merges: number;
    reverts: number;
    activeDays: number;
    linesAdded: number;
    linesDeleted: number;
    filesTouched: number;
  };
  streaks: {
    longest: Span | null;
    longestGap: Span | null;
    busiestDay: { date: string; commits: number } | null;
  };
  time: {
    byHour: number[];
    byWeekday: number[];
    peakHour: number;
    peakWeekday: string;
    shares: { night: number; early: number; office: number; weekend: number };
    persona: HourPersona;
  };
  files: {
    top: Ranked[];
    topDirectories: Ranked[];
    languages: Array<{ name: string; lines: number; share: number }>;
    obsession: { path: string; commits: number; days: number } | null;
  };
  size: {
    biggest: CommitRef | null;
    smallest: CommitRef | null;
    average: number;
    median: number;
    addDeleteRatio: number | null;
    style: WorkStyle;
  };
  messages: {
    averageSubjectLength: number;
    topWords: Array<{ word: string; count: number }>;
    conventionalShare: number;
    conventionalTypes: Array<{ type: string; count: number }>;
    wip: number;
    typo: number;
    oops: number;
    joke: string;
    longest: { hash: string; subject: string; length: number } | null;
    emojiCommits: number;
    topEmoji: Array<{ emoji: string; count: number }>;
  };
  collaboration: {
    coAuthors: Person[];
    pairedCommits: number;
    pairedShare: number;
    authors: Person[];
    busFactor: number;
  };
  personality: Personality;
  oneLiner: string;
}

export interface StatsContext {
  repo: { name: string; path: string; branch: string };
  filters: WrappedStats["filters"];
  top: number;
  year?: string;
}

interface FileTally {
  commits: number;
  lines: number;
  days: Set<string>;
}

const DAY_MS = 86_400_000;

/**
 * Accumulates everything in one pass over the log. Only per-file, per-day and
 * per-word tallies are kept, never the commits themselves, so memory stays
 * flat on very long histories.
 */
export class StatsCollector {
  private commits = 0;
  private merges = 0;
  private reverts = 0;
  private added = 0;
  private deleted = 0;
  private first: { time: number; day: string } | null = null;
  private last: { time: number; day: string } | null = null;
  private readonly dayCounts = new Map<string, number>();
  private readonly byHour: number[] = new Array<number>(24).fill(0);
  private readonly byWeekday: number[] = new Array<number>(7).fill(0);
  private readonly files = new Map<string, FileTally>();
  private readonly dirs = new Map<string, Ranked>();
  private readonly languages = new Map<string, number>();
  private readonly sizes: number[] = [];
  private biggest: CommitRef | null = null;
  private smallest: CommitRef | null = null;
  private messageCount = 0;
  private subjectChars = 0;
  private readonly words = new Map<string, number>();
  private readonly conventional = new Map<string, number>();
  private wip = 0;
  private typo = 0;
  private oops = 0;
  private longest: WrappedStats["messages"]["longest"] = null;
  private emojiCommits = 0;
  private readonly emoji = new Map<string, number>();
  private readonly coAuthors = new Map<string, Person>();
  private pairedCommits = 0;
  private readonly authors = new Map<string, Person>();

  add(commit: Commit): void {
    const day = commit.authorDate.slice(0, 10);
    const hour = Number(commit.authorDate.slice(11, 13));
    this.commits += 1;
    this.trackDates(commit.authorDate, day);
    this.dayCounts.set(day, (this.dayCounts.get(day) ?? 0) + 1);
    this.byHour[hour] = (this.byHour[hour] ?? 0) + 1;
    const weekday = weekdayIndex(day);
    this.byWeekday[weekday] = (this.byWeekday[weekday] ?? 0) + 1;

    const lines = this.trackFiles(commit, day);
    this.trackAuthor(commit, lines);
    this.trackCoAuthors(commit.message);

    if (commit.parents.length > 1) {
      this.merges += 1;
      return;
    }
    const subject = subjectOf(commit.message);
    if (isRevert(subject)) this.reverts += 1;
    this.trackSize(commit, subject, lines, day);
    this.trackMessage(commit, subject);
  }

  finish(context: StatsContext): WrappedStats {
    const { top } = context;
    const shares = hourShares(this.byHour, this.byWeekday);
    const persona = hourPersona(shares);
    const style = workStyle(this.added, this.deleted);
    const average = this.sizes.length ? sumOf(this.sizes) / this.sizes.length : 0;
    const days = [...this.dayCounts.keys()].sort();
    const longest = longestStreak(days);
    const conventionalCount = sumOf([...this.conventional.values()]);
    const conventionalShare = this.messageCount ? conventionalCount / this.messageCount : 0;
    const traits = personality({
      persona,
      style,
      longestStreak: longest?.days ?? 0,
      averageCommitSize: average,
      conventionalShare,
    });
    const languages = this.languageShares(top);
    const authors = rankPeople(this.authors);
    const period = {
      first: this.first?.day ?? null,
      last: this.last?.day ?? null,
      label: context.year ?? periodLabel(this.first?.day ?? null, this.last?.day ?? null),
    };

    return {
      repo: context.repo,
      filters: context.filters,
      period,
      totals: {
        commits: this.commits,
        merges: this.merges,
        reverts: this.reverts,
        activeDays: days.length,
        linesAdded: this.added,
        linesDeleted: this.deleted,
        filesTouched: this.files.size,
      },
      streaks: {
        longest,
        longestGap: longestGap(days),
        busiestDay: busiestDay(this.dayCounts),
      },
      time: {
        byHour: [...this.byHour],
        byWeekday: [...this.byWeekday],
        peakHour: indexOfMax(this.byHour),
        peakWeekday: WEEKDAYS[indexOfMax(this.byWeekday)]!,
        shares,
        persona,
      },
      files: {
        top: this.topFiles(top),
        topDirectories: rank([...this.dirs.values()], top),
        languages,
        obsession: this.obsession(),
      },
      size: {
        biggest: this.biggest,
        smallest: this.smallest,
        average: round(average, 1),
        median: median(this.sizes),
        addDeleteRatio: this.deleted ? round(this.added / this.deleted, 2) : null,
        style,
      },
      messages: {
        averageSubjectLength: this.messageCount ? round(this.subjectChars / this.messageCount, 1) : 0,
        topWords: topEntries(this.words, top).map(([word, count]) => ({ word, count })),
        conventionalShare: round(conventionalShare, 3),
        conventionalTypes: topEntries(this.conventional, 11).map(([type, count]) => ({ type, count })),
        wip: this.wip,
        typo: this.typo,
        oops: this.oops,
        joke: oopsJoke(this.wip + this.typo + this.oops, this.messageCount),
        longest: this.longest,
        emojiCommits: this.emojiCommits,
        topEmoji: topEntries(this.emoji, top).map(([emoji, count]) => ({ emoji, count })),
      },
      collaboration: {
        coAuthors: rankPeople(this.coAuthors).slice(0, top),
        pairedCommits: this.pairedCommits,
        pairedShare: this.commits ? round(this.pairedCommits / this.commits, 3) : 0,
        authors: authors.slice(0, top),
        busFactor: busFactor(authors.map((author) => author.commits)),
      },
      personality: traits,
      oneLiner: oneLiner({
        commits: this.commits,
        activeDays: days.length,
        streak: longest?.days ?? 0,
        language: languages[0]?.name ?? null,
        persona,
      }),
    };
  }

  private trackDates(iso: string, day: string): void {
    const time = Date.parse(iso);
    if (!this.first || time < this.first.time) this.first = { time, day };
    if (!this.last || time > this.last.time) this.last = { time, day };
  }

  /** Returns the non-generated lines this commit changed. */
  private trackFiles(commit: Commit, day: string): number {
    let lines = 0;
    const dirsInCommit = new Map<string, number>();
    for (const file of commit.files) {
      if (isGenerated(file.path)) continue;
      const changed = file.added + file.deleted;
      lines += changed;
      this.added += file.added;
      this.deleted += file.deleted;
      const tally = this.files.get(file.path) ?? { commits: 0, lines: 0, days: new Set<string>() };
      tally.commits += 1;
      tally.lines += changed;
      tally.days.add(day);
      this.files.set(file.path, tally);
      const dir = directoryOf(file.path);
      dirsInCommit.set(dir, (dirsInCommit.get(dir) ?? 0) + changed);
      if (changed > 0) {
        const language = languageOf(file.path);
        this.languages.set(language, (this.languages.get(language) ?? 0) + changed);
      }
    }
    for (const [dir, changed] of dirsInCommit) {
      const tally = this.dirs.get(dir) ?? { name: dir, commits: 0, lines: 0 };
      tally.commits += 1;
      tally.lines += changed;
      this.dirs.set(dir, tally);
    }
    return lines;
  }

  private trackAuthor(commit: Commit, lines: number): void {
    const key = authorKey(commit);
    const person = this.authors.get(key) ?? {
      name: commit.authorName,
      email: commit.authorEmail,
      commits: 0,
      lines: 0,
    };
    person.commits += 1;
    person.lines += lines;
    this.authors.set(key, person);
  }

  private trackCoAuthors(message: string): void {
    const coAuthors = coAuthorsOf(message);
    if (coAuthors.length === 0) return;
    this.pairedCommits += 1;
    for (const { name, email } of coAuthors) {
      const person = this.coAuthors.get(email) ?? { name, email, commits: 0, lines: 0 };
      person.commits += 1;
      this.coAuthors.set(email, person);
    }
  }

  private trackSize(commit: Commit, subject: string, lines: number, day: string): void {
    if (lines === 0) return;
    this.sizes.push(lines);
    const ref = { hash: commit.hash.slice(0, 7), subject, lines, date: day };
    if (!this.biggest || lines > this.biggest.lines) this.biggest = ref;
    if (!this.smallest || lines < this.smallest.lines) this.smallest = ref;
  }

  private trackMessage(commit: Commit, subject: string): void {
    this.messageCount += 1;
    this.subjectChars += [...subject].length;
    for (const word of wordsOf(commit.message)) {
      this.words.set(word, (this.words.get(word) ?? 0) + 1);
    }
    const type = conventionalTypeOf(subject);
    if (type) this.conventional.set(type, (this.conventional.get(type) ?? 0) + 1);
    const oopsies = oopsiesOf(subject);
    if (oopsies.wip) this.wip += 1;
    if (oopsies.typo) this.typo += 1;
    if (oopsies.oops) this.oops += 1;
    const length = [...commit.message].length;
    if (!this.longest || length > this.longest.length) {
      this.longest = { hash: commit.hash.slice(0, 7), subject, length };
    }
    const emoji = emojiOf(commit.message);
    if (emoji.length > 0) this.emojiCommits += 1;
    for (const glyph of emoji) this.emoji.set(glyph, (this.emoji.get(glyph) ?? 0) + 1);
  }

  private topFiles(top: number): Ranked[] {
    const ranked = [...this.files].map(([name, tally]) => ({
      name,
      commits: tally.commits,
      lines: tally.lines,
    }));
    return rank(ranked, top);
  }

  private obsession(): WrappedStats["files"]["obsession"] {
    const [top] = this.topFiles(1);
    if (!top || top.commits < 2) return null;
    const days = this.files.get(top.name)!.days.size;
    return { path: top.name, commits: top.commits, days };
  }

  private languageShares(top: number): WrappedStats["files"]["languages"] {
    const total = sumOf([...this.languages.values()]);
    return topEntries(this.languages, top).map(([name, lines]) => ({
      name,
      lines,
      share: total ? round(lines / total, 3) : 0,
    }));
  }
}

export function longestStreak(sortedDays: string[]): Span | null {
  if (sortedDays.length === 0) return null;
  let best: Span = { days: 1, start: sortedDays[0]!, end: sortedDays[0]! };
  let current = { ...best };
  for (let i = 1; i < sortedDays.length; i++) {
    const day = sortedDays[i]!;
    if (dayNumber(day) - dayNumber(sortedDays[i - 1]!) === 1) {
      current = { days: current.days + 1, start: current.start, end: day };
    } else {
      current = { days: 1, start: day, end: day };
    }
    if (current.days > best.days) best = current;
  }
  return best;
}

/** The longest run of days with no commits between two active days. */
export function longestGap(sortedDays: string[]): Span | null {
  let best: Span | null = null;
  for (let i = 1; i < sortedDays.length; i++) {
    const gap = dayNumber(sortedDays[i]!) - dayNumber(sortedDays[i - 1]!) - 1;
    if (gap > 0 && (!best || gap > best.days)) {
      best = { days: gap, start: sortedDays[i - 1]!, end: sortedDays[i]! };
    }
  }
  return best;
}

/** Fewest authors whose commits add up to at least half of all commits. */
export function busFactor(commitCounts: number[]): number {
  const sorted = [...commitCounts].sort((a, b) => b - a);
  const total = sumOf(sorted);
  let covered = 0;
  for (let i = 0; i < sorted.length; i++) {
    covered += sorted[i]!;
    if (covered * 2 >= total) return i + 1;
  }
  return 0;
}

export function periodLabel(first: string | null, last: string | null): string {
  if (!first || !last) return "this repo";
  const from = first.slice(0, 4);
  const to = last.slice(0, 4);
  return from === to ? from : `${from}–${to}`;
}

interface OneLinerInput {
  commits: number;
  activeDays: number;
  streak: number;
  language: string | null;
  persona: HourPersona;
}

export function oneLiner(input: OneLinerInput): string {
  const parts = [
    `${plural(input.commits, "commit")} across ${plural(input.activeDays, "active day")}`,
    `${articleFor(input.streak)} ${input.streak}-day best streak`,
  ];
  if (input.language) parts.push(`mostly ${input.language}`);
  return `${parts.join(", ")}, ${PERSONA_PHRASES[input.persona]}.`;
}

/** "an 11-day streak" but "a 12-day streak": English reads the number aloud. */
function articleFor(count: number): "a" | "an" {
  const spoken = String(count);
  return /^8/.test(spoken) || /^1[18](\d{3})*$/.test(spoken) ? "an" : "a";
}

/**
 * The same person often commits from a work and a personal address, so
 * authors are grouped by display name and fall back to email when unnamed.
 */
function authorKey(commit: Commit): string {
  const name = commit.authorName.trim().toLowerCase();
  return name || commit.authorEmail.toLowerCase();
}

export function plural(count: number, noun: string): string {
  return `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;
}

function busiestDay(dayCounts: Map<string, number>): WrappedStats["streaks"]["busiestDay"] {
  let best: { date: string; commits: number } | null = null;
  for (const [date, commits] of dayCounts) {
    if (!best || commits > best.commits || (commits === best.commits && date < best.date)) {
      best = { date, commits };
    }
  }
  return best;
}

function rank(items: Ranked[], top: number): Ranked[] {
  return items
    .sort((a, b) => b.commits - a.commits || b.lines - a.lines || a.name.localeCompare(b.name))
    .slice(0, top);
}

function rankPeople(people: Map<string, Person>): Person[] {
  return [...people.values()].sort(
    (a, b) => b.commits - a.commits || b.lines - a.lines || a.email.localeCompare(b.email),
  );
}

function topEntries(counts: Map<string, number>, top: number): Array<[string, number]> {
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top);
}

function dayNumber(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS;
}

/** Monday is 0, Sunday is 6. Uses the calendar date in the author's timezone. */
function weekdayIndex(day: string): number {
  return (new Date(dayNumber(day) * DAY_MS).getUTCDay() + 6) % 7;
}

function indexOfMax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i]! > values[best]!) best = i;
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function sumOf(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
