# MasterBot

A Telegram bot that acts as a remote process manager for your local Node.js projects. Start, stop, restart, schedule, and monitor apps on your machine straight from Telegram.

> **Windows only.** Uses `taskkill` / `tasklist` internally. Linux/macOS users will need to swap those calls with `kill` / `ps`.

## Demo

[![Demo](https://img.youtube.com/vi/kNCBs4d-7hI/0.jpg)](https://youtube.com/shorts/kNCBs4d-7hI)

## Prerequisites

- **Node.js** v18 or higher
- **Windows** (see note above)
- A Telegram bot token — create one via [@BotFather](https://t.me/BotFather) (`/newbot`)
- Your numeric Telegram user ID — get it from [@userinfobot](https://t.me/userinfobot)

## Features

- Start / stop / restart configured projects from an inline Telegram keyboard
- Live CPU, RAM, and uptime stats per process (via `pidusage`) plus system resource overview
- Log capture with on-demand viewing, clearing, and optional live tailing to chat
- Auto-restart on crash (toggleable per project)
- Cron-based scheduling (daily / weekly / biweekly / monthly) that persists across restarts
- `git pull` per project from chat
- Orphaned-process detection on startup (guards against duplicate instances and Telegram 409 conflicts)
- Admin-only access control

## Setup

```bash
npm install
copy .env.example .env        # add your bot token and Telegram user ID
copy config.json.example config.json   # list the projects to manage
npm start
```

### Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token from [@BotFather](https://t.me/BotFather) |
| `ADMIN_ID` | Your numeric Telegram user ID (only this user can control the bot) |

### config.json

```json
{
  "projects": [
    {
      "id": "my_app",
      "name": "My App",
      "path": "C:/path/to/project",
      "command": "npm",
      "args": ["start"]
    }
  ]
}
```

## Architecture

```
index.js           # Entry point: loads env, wires bot + scheduler
botHandlers.js     # Telegram UI: commands, inline keyboards, callbacks
processManager.js  # Spawning, stopping, stats, logs, PID persistence
scheduler.js       # node-cron jobs persisted to schedules.json
stop-background.js # Cleanup utility: kills managed/orphaned processes
```

## Notes

- Spawned children get a sanitized environment so they load their own `.env` rather than inheriting the bot's secrets.
- Never commit your `.env` file — it contains your bot token. Add it to `.gitignore`.

## License

MIT
