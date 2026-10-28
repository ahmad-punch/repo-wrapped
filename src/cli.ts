import { main } from "./main.js";

main(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  env: process.env,
  isTTY: Boolean(process.stdout.isTTY),
  ...(process.stdout.columns ? { columns: process.stdout.columns } : {}),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`repo-wrapped: unexpected error: ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 2;
  },
);
