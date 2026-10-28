const LANGUAGES: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", pyi: "Python", ipynb: "Jupyter",
  go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", kts: "Kotlin", scala: "Scala",
  swift: "Swift", m: "Objective-C", mm: "Objective-C",
  rb: "Ruby", php: "PHP", ex: "Elixir", exs: "Elixir", erl: "Erlang", hs: "Haskell",
  c: "C", h: "C", cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++", hh: "C++",
  cs: "C#", fs: "F#", dart: "Dart", lua: "Lua", r: "R", jl: "Julia", zig: "Zig",
  sh: "Shell", bash: "Shell", zsh: "Shell", fish: "Shell", ps1: "PowerShell",
  html: "HTML", htm: "HTML", css: "CSS", scss: "CSS", sass: "CSS", less: "CSS",
  vue: "Vue", svelte: "Svelte", astro: "Astro",
  md: "Markdown", mdx: "Markdown", rst: "reStructuredText", txt: "Text",
  json: "JSON", jsonc: "JSON", yml: "YAML", yaml: "YAML", toml: "TOML", xml: "XML",
  ini: "INI", sql: "SQL", prisma: "Prisma", graphql: "GraphQL", gql: "GraphQL",
  proto: "Protobuf", tf: "Terraform", hcl: "Terraform", nix: "Nix", svg: "SVG",
};

const NAMED_FILES: Record<string, string> = {
  dockerfile: "Docker",
  makefile: "Make",
  justfile: "Make",
  gemfile: "Ruby",
  rakefile: "Ruby",
};

const LOCKFILES = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock",
  "npm-shrinkwrap.json", "cargo.lock", "poetry.lock", "uv.lock", "pipfile.lock",
  "gemfile.lock", "composer.lock", "go.sum", "pubspec.lock", "podfile.lock",
  "packages.lock.json", "flake.lock", "mix.lock",
]);

const GENERATED_DIRS = /(^|\/)(node_modules|vendor|dist|build|out|coverage|\.next|__snapshots__|__golden__)\//;
const GENERATED_FILES = /\.(min\.(js|css)|map|snap|lock)$|\.generated\.[a-z]+$/;

export function fileName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

/**
 * Lockfiles, build output, vendored code, snapshots and `*.generated.*` files are excluded from
 * line-based stats so a dependency bump never wins "biggest commit".
 */
export function isGenerated(path: string): boolean {
  return (
    LOCKFILES.has(fileName(path).toLowerCase()) ||
    GENERATED_DIRS.test(path) ||
    GENERATED_FILES.test(path)
  );
}

export function languageOf(path: string): string {
  const name = fileName(path).toLowerCase();
  const named = NAMED_FILES[name] ?? NAMED_FILES[name.split(".")[0] ?? ""];
  if (named) return named;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "Other";
  const ext = name.slice(dot + 1);
  return LANGUAGES[ext] ?? `.${ext}`;
}

/** The directory a file lives in, capped at two levels so siblings group together. */
export function directoryOf(path: string, depth = 2): string {
  const segments = path.split("/").slice(0, -1);
  if (segments.length === 0) return "(root)";
  return segments.slice(0, depth).join("/");
}
