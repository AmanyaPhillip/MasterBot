# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Reorganized project layout: core modules moved to `src/`, utility scripts to `scripts/`, and runtime state (`schedules.json`, `active_pids.json`) to a git-ignored `data/` directory.
- Declared a Node.js engine requirement (`>=18`) in `package.json`.

### Removed
- Removed the committed demo video (`demo.mp4`) from the repository; the demo remains hosted on YouTube.

### Security
- Added `SECURITY.md` describing vulnerability reporting and credential handling.

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

[Unreleased]: https://github.com/AmanyaPhillip/MasterBot/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/AmanyaPhillip/MasterBot/releases/tag/v1.0.0
