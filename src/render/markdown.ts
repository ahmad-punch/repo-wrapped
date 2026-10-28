import { plural, type WrappedStats } from "../stats.js";
import { formatNumber, hourLabel, percent, sparkline } from "./text.js";

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function table(headers: string[], rows: string[][]): string[] {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ];
}

function span(value: { days: number; start: string; end: string } | null, noun: string): string {
  return value ? `${plural(value.days, noun)} (${value.start} to ${value.end})` : "n/a";
}

export function renderMarkdown(stats: WrappedStats): string {
  const { totals, streaks, time, files, size, messages, collaboration } = stats;
  const lines: string[] = [
    `# ${stats.repo.name}: wrapped ${stats.period.label}`,
    "",
    `> ${stats.oneLiner}`,
    "",
    `**Coding personality:** ${stats.personality.label} (${stats.personality.reason})`,
    "",
    ...table(
      ["Stat", "Value"],
      [
        ["Commits", formatNumber(totals.commits)],
        ["Active days", formatNumber(totals.activeDays)],
        ["First / last commit", `${stats.period.first ?? "n/a"} / ${stats.period.last ?? "n/a"}`],
        ["Longest streak", span(streaks.longest, "day")],
        ["Longest break", span(streaks.longestGap, "day")],
        ["Busiest day", streaks.busiestDay ? `${streaks.busiestDay.date} (${plural(streaks.busiestDay.commits, "commit")})` : "n/a"],
        ["Lines", `+${formatNumber(totals.linesAdded)} / -${formatNumber(totals.linesDeleted)}`],
        ["Merges / reverts", `${totals.merges} / ${totals.reverts}`],
        ["Peak hour", `${hourLabel(time.peakHour)} (${time.persona})`],
        ["Peak weekday", time.peakWeekday],
        ["Conventional commits", percent(messages.conventionalShare)],
      ],
    ),
    "",
    "## Your hour",
    "",
    "```text",
    sparkline(time.byHour, 2),
    "00    06    12    18    23",
    "```",
    "",
    "## Top files",
    "",
    ...table(["File", "Commits", "Lines changed"], files.top.map((f) => [`\`${f.name}\``, String(f.commits), formatNumber(f.lines)])),
    "",
    "## Languages",
    "",
    ...table(["Language", "Lines changed", "Share"], files.languages.map((l) => [l.name, formatNumber(l.lines), percent(l.share)])),
    "",
    "## Commits",
    "",
  ];
  if (files.obsession) {
    lines.push(`- The file you can't leave alone: \`${files.obsession.path}\` (${plural(files.obsession.commits, "commit")} on ${plural(files.obsession.days, "day")})`);
  }
  if (size.biggest) lines.push(`- Biggest commit: ${plural(size.biggest.lines, "line")}, \`${size.biggest.hash}\` "${size.biggest.subject}"`);
  if (size.smallest) lines.push(`- Smallest meaningful commit: ${plural(size.smallest.lines, "line")}, \`${size.smallest.hash}\` "${size.smallest.subject}"`);
  lines.push(
    `- Average commit: ${size.average} lines (median ${size.median}), style: ${size.style}`,
    `- Average subject: ${messages.averageSubjectLength} characters`,
    `- Top words: ${messages.topWords.map((w) => `${w.word} (${w.count})`).join(", ") || "none"}`,
    `- wip / typo / oops: ${messages.wip} / ${messages.typo} / ${messages.oops}. ${messages.joke}`,
  );
  if (collaboration.pairedCommits > 0) {
    lines.push(`- Paired on ${plural(collaboration.pairedCommits, "commit")} with ${collaboration.coAuthors.map((p) => p.name).join(", ")}`);
  }
  if (stats.filters.allAuthors) {
    lines.push(
      "",
      "## Team",
      "",
      ...table(["Author", "Commits", "Lines changed"], collaboration.authors.map((a) => [a.name, String(a.commits), formatNumber(a.lines)])),
      "",
      `Bus factor: **${collaboration.busFactor}**`,
    );
  }
  lines.push("", "_Generated offline by repo-wrapped._", "");
  return lines.join("\n");
}
