# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-22

### Security
- Require a valid `ADMIN_ID` at startup and remove the `adminId === 0` authentication bypass, so the bot can never start in an unauthenticated state.
- Guard Telegram sends in the process `close` handler with `.catch`, so a Telegram API outage can no longer crash the bot.
- Added `SECURITY.md` describing vulnerability reporting and credential handling.

### Changed
- Switch inline-keyboard callback-data delimiter from `_` to `:` and validate project ids at config load, so project ids containing underscores parse correctly.
- Reorganized project layout: core modules in `src/`, utility scripts in `scripts/`, and runtime state (`schedules.json`, `active_pids.json`) in a git-ignored `data/` directory.
- Declared a Node.js engine requirement (`>=18`) in `package.json`.

### Removed
- Removed the committed demo video (`demo.mp4`) from the repository; the demo remains hosted on YouTube.

## [1.0.0] - 2026-06-15

### Added
- Initial public release.
- Start / stop / restart configured Node.js projects from a Telegram inline keyboard.
- Live CPU, RAM, and uptime stats per process via `pidusage`, plus a system resource overview.
- Log capture with on-demand viewing, clearing, and live tailing to chat.
- Auto-restart on crash (toggleable per project).
- Cron-based scheduling (daily / weekly / biweekly / monthly) persisted across restarts.
- Per-project `git pull` from chat.
- Orphaned-process detection on startup (guards against duplicate instances and Telegram 409 conflicts).
- Admin-only access control.

[1.1.0]: https://github.com/AmanyaPhillip/MasterBot/releases/tag/v1.1.0
[1.0.0]: https://github.com/AmanyaPhillip/MasterBot/releases/tag/v1.0.0
