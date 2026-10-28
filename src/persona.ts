/**
 * Persona rules. Every label is a pure function of the stats, so the same
 * history always produces the same personality. The README documents these
 * thresholds; keep the two in sync.
 */

export type HourPersona = "Night owl" | "Early bird" | "Weekend warrior" | "9-to-5er" | "Around the clock";
export type WorkStyle = "builder" | "gardener" | "balanced";

export interface HourShares {
  night: number;
  early: number;
  office: number;
  weekend: number;
}

const NIGHT_HOURS = new Set([22, 23, 0, 1, 2, 3, 4]);
const EARLY_HOURS = new Set([5, 6, 7, 8]);

/** `byWeekday` is Monday-first, so indexes 5 and 6 are the weekend. */
export function hourShares(byHour: number[], byWeekday: number[]): HourShares {
  const total = sum(byHour);
  if (total === 0) return { night: 0, early: 0, office: 0, weekend: 0 };
  const share = (predicate: (hour: number) => boolean) =>
    sum(byHour.filter((_, hour) => predicate(hour))) / total;
  return {
    night: share((hour) => NIGHT_HOURS.has(hour)),
    early: share((hour) => EARLY_HOURS.has(hour)),
    office: share((hour) => hour >= 9 && hour <= 17),
    weekend: ((byWeekday[5] ?? 0) + (byWeekday[6] ?? 0)) / total,
  };
}

export function hourPersona(shares: HourShares): HourPersona {
  if (shares.night >= 0.3) return "Night owl";
  if (shares.early >= 0.2) return "Early bird";
  if (shares.weekend >= 0.35) return "Weekend warrior";
  if (shares.office >= 0.6) return "9-to-5er";
  return "Around the clock";
}

/** Lines added per line deleted decides whether you grow code or prune it. */
export function workStyle(added: number, deleted: number): WorkStyle {
  if (added + deleted === 0) return "balanced";
  const ratio = deleted === 0 ? Infinity : added / deleted;
  if (ratio >= 2) return "builder";
  if (ratio < 1.25) return "gardener";
  return "balanced";
}

const ADJECTIVES: Record<HourPersona, string> = {
  "Night owl": "Midnight",
  "Early bird": "Sunrise",
  "Weekend warrior": "Weekend",
  "9-to-5er": "Steady",
  "Around the clock": "Restless",
};

export const PERSONA_PHRASES: Record<HourPersona, string> = {
  "Night owl": "mostly after dark",
  "Early bird": "mostly before breakfast",
  "Weekend warrior": "mostly on weekends",
  "9-to-5er": "mostly between standups",
  "Around the clock": "at every hour of the day",
};

export interface PersonalityInput {
  persona: HourPersona;
  style: WorkStyle;
  longestStreak: number;
  averageCommitSize: number;
  conventionalShare: number;
}

export interface Personality {
  label: string;
  adjective: string;
  noun: string;
  reason: string;
}

export function personality(input: PersonalityInput): Personality {
  const adjective = ADJECTIVES[input.persona];
  const [noun, reason] = personalityNoun(input);
  return { label: `The ${adjective} ${noun}`, adjective, noun, reason: `${input.persona}; ${reason}` };
}

function personalityNoun(input: PersonalityInput): [string, string] {
  if (input.longestStreak >= 14) return ["Marathoner", `a ${input.longestStreak}-day streak`];
  if (input.style === "builder" && input.averageCommitSize >= 150) {
    return ["Architect", `big additive commits (avg ${Math.round(input.averageCommitSize)} lines)`];
  }
  if (input.style === "gardener") return ["Gardener", "you delete nearly as much as you add"];
  if (input.conventionalShare >= 0.6) {
    return ["Librarian", `${Math.round(input.conventionalShare * 100)}% conventional commits`];
  }
  if (input.style === "builder") return ["Builder", "you add at least twice what you delete"];
  return ["Tinkerer", "small, steady, balanced changes"];
}

export function oopsJoke(count: number, commits: number): string {
  if (commits === 0 || count === 0) return "Not a single wip, typo or oops. Suspiciously tidy.";
  const share = count / commits;
  if (count <= 3) return "A handful of oopsies. Proof a human was here.";
  if (share < 0.05) return "Every typo you fixed is a typo you found first.";
  if (share < 0.15) return "Your keyboard would like a word. Several, spelled correctly.";
  return "At this point, \"fix typo\" is a love language.";
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
