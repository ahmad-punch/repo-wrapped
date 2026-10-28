import { writeFile } from "node:fs/promises";
import { Command, InvalidArgumentError } from "commander";
import { UserError } from "./errors.js";
import { renderCards, cardWidthFor } from "./render/cards.js";
import { colors, shouldUseColor } from "./render/colors.js";
import { renderMarkdown } from "./render/markdown.js";
import { renderSvg } from "./render/svg.js";
import { VERSION } from "./version.js";
import { collectStats } from "./wrap.js";

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  env: NodeJS.ProcessEnv;
  isTTY: boolean;
  columns?: number;
}

interface CliOptions {
  since?: string;
  until?: string;
  year?: string;
  author?: string;
  allAuthors?: boolean;
  branch?: string;
  top: number;
  json?: boolean;
  md?: string | boolean;
  svg?: string;
  color: boolean;
}

function positiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new InvalidArgumentError("expected a whole number between 1 and 100.");
  }
  return parsed;
}

function buildProgram(): Command {
  return new Command()
    .name("repo-wrapped")
    .description("Spotify Wrapped for any git repository. Offline, from git log alone.")
    .version(VERSION, "-v, --version")
    .argument("[path]", "path to a git repository", ".")
    .option("--since <date>", "only commits after this date (anything git understands)")
    .option("--until <date>", "only commits before this date")
    .option("--year <yyyy>", "shortcut for --since <yyyy>-01-01 --until <yyyy>-12-31")
    .option("--author <pattern>", "only commits whose author matches (default: your git user.email)")
    .option("--all-authors", "wrap every author and show a leaderboard and bus factor")
    .option("--branch <name>", "branch or revision to read (default: HEAD)")
    .option("--top <n>", "how many items in each top list", positiveInt, 5)
    .option("--json", "print raw stats as JSON instead of cards")
    .option("--md [file]", "write a Markdown summary to a file, or print it when no file is given")
    .option("--svg <file>", "write a 1200x630 shareable SVG card")
    .option("--no-color", "disable colours (NO_COLOR is respected too)")
    .showHelpAfterError("(run repo-wrapped --help for usage)");
}

/** Runs the CLI and resolves to a process exit code. */
export async function main(argv: string[], io: Io): Promise<number> {
  const program = buildProgram()
    .exitOverride()
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr });
  try {
    program.parse(argv, { from: "user" });
  } catch (error) {
    const code = (error as { exitCode?: number }).exitCode;
    return typeof code === "number" ? code : 1;
  }
  const options = program.opts<CliOptions>();
  const path = program.args[0] ?? ".";
  try {
    const stats = await collectStats({
      path,
      allAuthors: options.allAuthors ?? false,
      top: options.top,
      ...pick(options, ["since", "until", "year", "author", "branch"]),
    });
    if (options.svg) {
      await writeFile(options.svg, renderSvg(stats), "utf8");
    }
    if (typeof options.md === "string") {
      await writeFile(options.md, renderMarkdown(stats), "utf8");
    }
    if (options.json) {
      io.stdout(`${JSON.stringify(stats, null, 2)}\n`);
    } else if (options.md === true) {
      io.stdout(renderMarkdown(stats));
    } else {
      const useColor = shouldUseColor({ flag: options.color, isTTY: io.isTTY, env: io.env });
      io.stdout(
        renderCards(stats, {
          colors: colors(useColor),
          width: cardWidthFor(io.columns),
          allAuthors: options.allAuthors ?? false,
        }),
      );
    }
    if (options.svg) io.stderr(`Saved SVG card to ${options.svg}\n`);
    if (typeof options.md === "string") io.stderr(`Saved Markdown summary to ${options.md}\n`);
    return 0;
  } catch (error) {
    if (error instanceof UserError) {
      io.stderr(`repo-wrapped: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

function pick<T extends object, K extends keyof T>(source: T, keys: K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}
