import type { HourPersona, HourShares } from "../persona.js";
import { WEEKDAYS, plural, type Ranked, type WrappedStats } from "../stats.js";
import type { Colors } from "./colors.js";
import {
  bar,
  fit,
  fitPath,
  formatNumber,
  hourLabel,
  padEnd,
  padStart,
  percent,
  sparkline,
  stripAnsi,
  visibleWidth,
  wrap,
} from "./text.js";

export interface CardOptions {
  colors: Colors;
  /** Total card width in columns, borders included. */
  width: number;
  allAuthors: boolean;
}

interface Ui {
  c: Colors;
  inner: number;
}

type Card = { title: string; lines: string[] };

export const DEFAULT_CARD_WIDTH = 64;
const MIN_CARD_WIDTH = 44;

export function cardWidthFor(columns: number | undefined): number {
  if (!columns) return DEFAULT_CARD_WIDTH;
  return Math.max(MIN_CARD_WIDTH, Math.min(DEFAULT_CARD_WIDTH, columns - 2));
}

export function renderCards(stats: WrappedStats, options: CardOptions): string {
  const ui: Ui = { c: options.colors, inner: options.width - 4 };
  const cards: Card[] = [
    introCard(stats, ui),
    streaksCard(stats, ui),
    hourCard(stats, ui),
    filesCard(stats, ui),
    sizeCard(stats, ui),
    messagesCard(stats, ui),
    collaborationCard(stats, ui, options.allAuthors),
    finaleCard(stats, ui),
  ];
  return cards.map((card) => box(card, ui)).join("\n\n") + "\n";
}

function box(card: Card, ui: Ui): string {
  const { c, inner } = ui;
  const title = ` ${card.title} `;
  const top = `╭─${c.bold(c.magenta(title))}${"─".repeat(Math.max(0, inner + 1 - visibleWidth(title)))}╮`;
  const blank = `│ ${" ".repeat(inner)} │`;
  const body = card.lines.map((line) => `│ ${padEnd(visibleWidth(line) > inner ? fit(stripAnsi(line), inner) : line, inner)} │`);
  const bottom = `╰${"─".repeat(inner + 2)}╯`;
  return [top, blank, ...body, blank, bottom].join("\n");
}

function stat(ui: Ui, value: string, label: string): string {
  return `${ui.c.bold(ui.c.cyan(padStart(value, 9)))}  ${label}`;
}

function heading(ui: Ui, text: string): string {
  return ui.c.bold(ui.c.yellow(text));
}

function quoted(ui: Ui, ref: { hash: string; subject: string }, room: number): string {
  return `${ui.c.dim(ref.hash)} ${fit(`"${ref.subject}"`, Math.max(8, room - ref.hash.length - 1))}`;
}

function introCard(stats: WrappedStats, ui: Ui): Card {
  const { c } = ui;
  const { totals, period } = stats;
  const who = stats.filters.allAuthors ? "everyone" : (stats.filters.author ?? "you");
  return {
    title: `REPO WRAPPED ${period.label}`,
    lines: [
      c.bold(fit(stats.repo.name, ui.inner)),
      c.dim(fit(`branch ${stats.repo.branch} · commits by ${who}`, ui.inner)),
      "",
      stat(ui, formatNumber(totals.commits), "commits"),
      stat(ui, formatNumber(totals.activeDays), "active days"),
      stat(ui, formatNumber(totals.filesTouched), "files touched"),
      stat(ui, `+${formatNumber(totals.linesAdded)}`, c.green("lines added")),
      stat(ui, `-${formatNumber(totals.linesDeleted)}`, c.red("lines deleted")),
      "",
      `First commit  ${c.bold(period.first ?? "n/a")}`,
      `Last commit   ${c.bold(period.last ?? "n/a")}`,
    ],
  };
}

function streaksCard(stats: WrappedStats, ui: Ui): Card {
  const { c } = ui;
  const { longest, longestGap, busiestDay } = stats.streaks;
  const lines = [
    heading(ui, "Longest streak"),
    longest
      ? `${c.bold(c.cyan(plural(longest.days, "day")))} in a row  ${c.dim(`${longest.start} → ${longest.end}`)}`
      : "No streaks yet.",
    "",
    heading(ui, "Longest break"),
    longestGap
      ? `${c.bold(c.cyan(plural(longestGap.days, "day")))} off  ${c.dim(`${longestGap.start} → ${longestGap.end}`)}`
      : "Never took a day off between commits.",
  ];
  if (busiestDay) {
    lines.push(
      "",
      heading(ui, "Force-of-nature day"),
      `${c.bold(c.cyan(plural(busiestDay.commits, "commit")))} on ${busiestDay.date}`,
    );
  }
  lines.push(
    "",
    `Merges ${c.bold(formatNumber(stats.totals.merges))}  ·  Reverts ${c.bold(formatNumber(stats.totals.reverts))}`,
  );
  return { title: "STREAKS", lines };
}

function hourCard(stats: WrappedStats, ui: Ui): Card {
  const { c } = ui;
  const { time } = stats;
  const repeat = ui.inner >= 50 ? 2 : 1;
  const axis = hourAxis(repeat);
  const maxDay = Math.max(...time.byWeekday);
  const dayBarWidth = Math.max(8, ui.inner - 12);
  const days = WEEKDAYS.map((day, i) => {
    const count = time.byWeekday[i] ?? 0;
    return `${day}  ${padEnd(c.magenta(bar(count, maxDay, dayBarWidth)), dayBarWidth)} ${c.dim(padStart(String(count), 4))}`;
  });
  return {
    title: "YOUR HOUR",
    lines: [
      c.cyan(sparkline(time.byHour, repeat)),
      c.dim(axis),
      "",
      ...days,
      "",
      `${c.bold(c.yellow(time.persona))}  ${c.dim(`peak ${hourLabel(time.peakHour)} · ${time.peakWeekday}`)}`,
      ...wrap(personaEvidence(time.persona, time.shares), ui.inner),
    ],
  };
}

function hourAxis(repeat: number): string {
  const width = 24 * repeat;
  const chars = new Array<string>(width).fill(" ");
  for (const hour of [0, 6, 12, 18, 23]) {
    const label = String(hour).padStart(2, "0");
    const at = Math.min(hour * repeat, width - label.length);
    chars[at] = label[0]!;
    chars[at + 1] = label[1]!;
  }
  return chars.join("");
}

export function personaEvidence(persona: HourPersona, shares: HourShares): string {
  switch (persona) {
    case "Night owl":
      return `${percent(shares.night)} of your commits landed between 22:00 and 05:00.`;
    case "Early bird":
      return `${percent(shares.early)} of your commits landed between 05:00 and 09:00.`;
    case "Weekend warrior":
      return `${percent(shares.weekend)} of your commits landed on a Saturday or Sunday.`;
    case "9-to-5er":
      return `${percent(shares.office)} of your commits landed between 09:00 and 18:00.`;
    case "Around the clock":
      return "No single part of the day owns you. Respect.";
  }
}

function rankedLines(ui: Ui, items: Ranked[]): string[] {
  const countWidth = Math.max(...items.map((item) => String(item.commits).length), 1);
  return items.map(
    (item) =>
      `${ui.c.cyan(padStart(String(item.commits), countWidth))}  ${fitPath(item.name, ui.inner - countWidth - 2)}`,
  );
}

function filesCard(stats: WrappedStats, ui: Ui): Card {
  const { c } = ui;
  const { files } = stats;
  const lines: string[] = [heading(ui, "Top files") + c.dim("  (commits)"), ...rankedLines(ui, files.top)];
  lines.push("", heading(ui, "Top directories"), ...rankedLines(ui, files.topDirectories));
  if (files.languages.length > 0) {
    lines.push("", heading(ui, "Languages") + c.dim("  (lines changed)"));
    const nameWidth = Math.min(14, Math.max(...files.languages.map((lang) => lang.name.length)));
    const barWidth = Math.max(6, ui.inner - nameWidth - 8);
    const maxShare = files.languages[0]!.share;
    for (const lang of files.languages) {
      lines.push(
        `${padEnd(fit(lang.name, nameWidth), nameWidth)}  ${padEnd(c.green(bar(lang.share, maxShare, barWidth)), barWidth)} ${padStart(percent(lang.share), 4)}`,
      );
    }
  }
  if (files.obsession) {
    lines.push(
      "",
      heading(ui, "The file you can't leave alone"),
      c.bold(fitPath(files.obsession.path, ui.inner)),
      `touched in ${plural(files.obsession.commits, "commit")} on ${plural(files.obsession.days, "different day")}`,
    );
  }
  return { title: "WHERE YOU LIVED", lines };
}

const STYLE_LINES: Record<WrappedStats["size"]["style"], string> = {
  builder: "Builder. You grow the codebase faster than you prune it.",
  gardener: "Gardener. You prune nearly as much as you plant.",
  balanced: "Balanced. Every new line pays for itself somewhere.",
};

function sizeCard(stats: WrappedStats, ui: Ui): Card {
  const { c } = ui;
  const { size, totals } = stats;
  const lines: string[] = [];
  if (size.biggest) {
    lines.push(heading(ui, "Biggest commit"), `${c.bold(c.cyan(plural(size.biggest.lines, "line")))}  ${c.dim(size.biggest.date)}`);
    lines.push(quoted(ui, size.biggest, ui.inner));
  }
  if (size.smallest) {
    lines.push("", heading(ui, "Smallest meaningful commit"), `${c.bold(c.cyan(plural(size.smallest.lines, "line")))}  ${c.dim(size.smallest.date)}`);
    lines.push(quoted(ui, size.smallest, ui.inner));
  }
  lines.push(
    "",
    `Average ${c.bold(`${formatNumber(size.average)} lines`)}  ·  median ${c.bold(formatNumber(size.median))}`,
    `${c.green(`+${formatNumber(totals.linesAdded)}`)} / ${c.red(`-${formatNumber(totals.linesDeleted)}`)}` +
      (size.addDeleteRatio === null ? "" : c.dim(`  (${size.addDeleteRatio} added per deleted)`)),
    ...wrap(STYLE_LINES[size.style], ui.inner),
  );
  return { title: "COMMIT SIZES", lines };
}

function messagesCard(stats: WrappedStats, ui: Ui): Card {
  const { c } = ui;
  const { messages } = stats;
  const words = messages.topWords.map((entry) => `${entry.word} ${c.dim(`×${entry.count}`)}`).join("  ");
  const types = messages.conventionalTypes.slice(0, 4).map((entry) => `${entry.type} ${entry.count}`).join(", ");
  const lines = [
    `Average subject ${c.bold(`${messages.averageSubjectLength} chars`)}`,
    `Conventional commits ${c.bold(percent(messages.conventionalShare))}`,
    ...(types ? wrap(types, ui.inner).map((line) => c.dim(line)) : []),
    "",
    heading(ui, "Your vocabulary"),
    ...(words ? wrap(words, ui.inner) : ["Mostly silence. Mysterious."]),
    "",
    heading(ui, "Confessions"),
    `wip ${c.bold(String(messages.wip))}  ·  typo ${c.bold(String(messages.typo))}  ·  oops ${c.bold(String(messages.oops))}`,
    ...wrap(messages.joke, ui.inner).map((line) => c.italic(line)),
  ];
  if (messages.longest) {
    lines.push("", heading(ui, "Longest message"), `${c.bold(plural(messages.longest.length, "char"))}`);
    lines.push(quoted(ui, messages.longest, ui.inner));
  }
  lines.push("");
  if (messages.emojiCommits > 0) {
    const top = messages.topEmoji.map((entry) => `${entry.emoji} ×${entry.count}`).join("  ");
    lines.push(`Emoji in ${c.bold(plural(messages.emojiCommits, "commit"))}`, ...wrap(top, ui.inner));
  } else {
    lines.push("No emoji. Strictly business.");
  }
  return { title: "COMMIT MESSAGES", lines };
}

function collaborationCard(stats: WrappedStats, ui: Ui, allAuthors: boolean): Card {
  const { c } = ui;
  const { collaboration, totals } = stats;
  const lines: string[] = [];
  if (allAuthors) {
    lines.push(heading(ui, "Leaderboard"));
    collaboration.authors.forEach((author, i) => {
      const share = totals.commits ? author.commits / totals.commits : 0;
      const right = `${formatNumber(author.commits)}  ${padStart(percent(share), 4)}`;
      const name = fit(`${i + 1}. ${author.name}`, ui.inner - visibleWidth(right) - 2);
      lines.push(`${padEnd(name, ui.inner - visibleWidth(right))}${c.cyan(right)}`);
    });
    lines.push(
      "",
      `Bus factor ${c.bold(c.yellow(String(collaboration.busFactor)))}`,
      ...wrap(busFactorLine(collaboration.busFactor), ui.inner),
      "",
    );
  }
  if (collaboration.pairedCommits > 0) {
    lines.push(
      heading(ui, "Pairing"),
      `${c.bold(plural(collaboration.pairedCommits, "commit"))} with co-authors (${percent(collaboration.pairedShare)})`,
      ...collaboration.coAuthors.map(
        (person) => `${c.cyan(padStart(String(person.commits), 4))}  ${fit(person.name, ui.inner - 6)}`,
      ),
    );
  } else {
    lines.push("Solo flight. No Co-authored-by trailers this time.");
  }
  return { title: allAuthors ? "THE TEAM" : "COLLABORATION", lines };
}

function busFactorLine(factor: number): string {
  if (factor <= 1) return "One person wrote half the commits. Buy them lunch, and write some docs.";
  if (factor === 2) return "Two people wrote half the commits. Pair them with someone new.";
  return `${factor} people share half the commits. Healthy spread.`;
}

function finaleCard(stats: WrappedStats, ui: Ui): Card {
  const { c } = ui;
  return {
    title: `YOUR ${stats.period.label.toUpperCase()} IN ONE LINE`,
    lines: [
      ...wrap(stats.oneLiner, ui.inner),
      "",
      c.dim("Your coding personality"),
      c.bold(c.magenta(stats.personality.label)),
      ...wrap(stats.personality.reason, ui.inner).map((line) => c.dim(line)),
    ],
  };
}
