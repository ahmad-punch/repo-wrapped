import type { WrappedStats } from "../stats.js";
import { formatNumber, hourLabel } from "./text.js";

export const SVG_WIDTH = 1200;
export const SVG_HEIGHT = 630;

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("")}…`;
}

function text(x: number, y: number, size: number, content: string, extra = ""): string {
  return `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escapeXml(content)}</text>`;
}

function tile(x: number, value: string, label: string): string {
  const valueSize = value.length > 7 ? 38 : 56;
  return [
    `<rect x="${x}" y="236" width="250" height="128" rx="22" fill="#ffffff" fill-opacity="0.1"/>`,
    text(x + 24, 310, valueSize, value, 'font-weight="800"'),
    text(x + 24, 344, 20, label, 'fill-opacity="0.75"'),
  ].join("\n  ");
}

function hourBars(byHour: number[]): string {
  const max = Math.max(...byHour, 0);
  const bars = byHour.map((count, hour) => {
    const height = max === 0 || count === 0 ? 4 : Math.max(6, Math.round((count / max) * 116));
    const x = 64 + hour * 25;
    const opacity = count === 0 ? 0.3 : 1;
    return `<rect x="${x}" y="${540 - height}" width="17" height="${height}" rx="4" fill="url(#bar)" fill-opacity="${opacity}"/>`;
  });
  const labels = [0, 6, 12, 18, 23].map((hour) =>
    text(64 + hour * 25, 568, 16, String(hour).padStart(2, "0"), 'fill-opacity="0.6"'),
  );
  return [...bars, ...labels].join("\n  ");
}

/** A 1200x630 OpenGraph card. Uses only system fonts so it renders anywhere. */
export function renderSvg(stats: WrappedStats): string {
  const { totals, time, personality, period } = stats;
  const language = stats.files.languages[0]?.name ?? "n/a";
  const range = period.first && period.last ? `${period.first} → ${period.last}` : "no commits";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="${escapeXml(`${stats.repo.name} wrapped ${period.label}: ${stats.oneLiner}`)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#140b2e"/>
      <stop offset="0.55" stop-color="#4c1d95"/>
      <stop offset="1" stop-color="#be185d"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#a3e635"/>
    </linearGradient>
  </defs>
  <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="url(#bg)"/>
  <circle cx="1080" cy="96" r="190" fill="#f472b6" fill-opacity="0.18"/>
  <circle cx="1150" cy="250" r="90" fill="#22d3ee" fill-opacity="0.14"/>
  <g font-family="${FONT}" fill="#ffffff">
  ${text(64, 92, 22, `REPO WRAPPED · ${period.label}`, 'font-weight="700" letter-spacing="4" fill="#f9a8d4"')}
  ${text(64, 152, 54, clip(stats.repo.name, 30), 'font-weight="800"')}
  ${text(64, 192, 22, `${stats.repo.branch} · ${range}`, 'fill-opacity="0.75"')}
  ${tile(64, formatNumber(totals.commits), "commits")}
  ${tile(338, formatNumber(totals.activeDays), "active days")}
  ${tile(612, formatNumber(stats.streaks.longest?.days ?? 0), "day best streak")}
  ${tile(886, clip(language, 11), "top language")}
  ${text(64, 408, 18, "YOUR HOUR", 'font-weight="700" letter-spacing="3" fill-opacity="0.75"')}
  ${hourBars(time.byHour)}
  ${text(720, 408, 18, "CODING PERSONALITY", 'font-weight="700" letter-spacing="3" fill-opacity="0.75"')}
  ${text(720, 462, 46, `The ${personality.adjective}`, 'font-weight="800"')}
  ${text(720, 516, 46, personality.noun, 'font-weight="800" fill="#a3e635"')}
  ${text(720, 556, 22, `${time.persona} · peak ${hourLabel(time.peakHour)} · ${time.peakWeekday}`, 'fill-opacity="0.85"')}
  ${text(64, 606, 18, clip(stats.oneLiner, 118), 'fill-opacity="0.65"')}
  </g>
</svg>
`;
}
