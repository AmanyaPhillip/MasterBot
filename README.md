# MasterBot

A Telegram bot that acts as a remote process manager for your local Node.js projects. Start, stop, restart, schedule, and monitor apps on your machine straight from Telegram.

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

- Windows-oriented (uses `taskkill` / `tasklist`); adapt for Linux/macOS by swapping the process-kill calls.
- Spawned children get a sanitized environment so they load their own `.env` rather than inheriting the bot's secrets.

## License

MIT
