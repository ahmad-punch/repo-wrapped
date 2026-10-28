# Contributing

Thanks for helping. Setup takes a minute:

```sh
pnpm install
pnpm test      # vitest, builds a throwaway fixture repo with fixed dates
pnpm lint      # eslint + tsc --noEmit
pnpm build && node dist/cli.js --all-authors
```

- Keep runtime dependencies to `commander` and `picocolors`. New stats should come from the single `git log --numstat` pass in `src/stats.ts`, not a second git call.
- Every new stat needs a fixture commit or a unit test that pins its value. If you change the SVG on purpose, update the snapshot with `pnpm test -u` and eyeball `test/__snapshots__/fixture-card.svg`.
- Commit messages: imperative mood, under 72 characters.
