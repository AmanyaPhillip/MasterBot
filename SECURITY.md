# Security Policy

## Supported Versions

The latest release on the `main` branch is actively maintained and receives security fixes.

## Reporting a Vulnerability

Please report security issues privately by email to **phllipamanya@gmail.com**
rather than opening a public issue. You can expect an initial response within a few days.

## Credential Handling

- All secrets live in a git-ignored `.env` file (`TELEGRAM_BOT_TOKEN`, `ADMIN_ID`) and are never committed.
- Project configuration (`config.json`) and runtime state (`schedules.json`, `active_pids.json`, `*.db`, logs) are git-ignored.
- Repository history has been audited and contains no exposed credentials.
- Spawned child processes receive a sanitized environment so they load their own `.env` rather than inheriting the bot's secrets.
