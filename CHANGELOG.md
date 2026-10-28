# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-28

### Added
- `repo-wrapped [path]` reads one streamed `git log --numstat` and prints a set of box-drawn cards: totals, streaks and gaps, hour and weekday histograms with a persona, top files, directories and languages, commit sizes, commit-message habits, collaboration, and a one-line summary with a personality label.
- Filters: `--since`, `--until`, `--year`, `--author`, `--branch`. Defaults to the repo's `git config user.email`; `--all-authors` adds a leaderboard and bus-factor estimate.
- Exports: `--json` for raw stats, `--svg <file>` for a 1200x630 share card with no external fonts, `--md [file]` for a Markdown summary.
- Colour via picocolors, off for non-TTY output, `NO_COLOR`, or `--no-color`.
- Friendly errors for a missing path, a folder that is not a repo, an empty history, an unknown branch, and filters that match nothing.
