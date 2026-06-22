const { spawn } = require('child_process');
const pidusage = require('pidusage');

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const PID_FILE = path.join(DATA_DIR, 'active_pids.json');

class ProcessManager {
    constructor() {
        this.processes = {}; // { projectId: { process, startTime, logs: [], autoRestart: bool, tailing: bool } }
        this._loadPids();
    }

    _loadPids() {
        try {
            if (fs.existsSync(PID_FILE)) {
                this.savedPids = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
            } else {
                this.savedPids = {};
            }
        } catch (e) {
            this.savedPids = {};
        }
    }

    _savePid(projectId, pid) {
        this.savedPids[projectId] = pid;
        try {
            fs.writeFileSync(PID_FILE, JSON.stringify(this.savedPids, null, 2));
        } catch (e) {
            console.error("Failed to save PID file", e);
        }
    }

    _removePid(projectId) {
        delete this.savedPids[projectId];
        try {
            fs.writeFileSync(PID_FILE, JSON.stringify(this.savedPids, null, 2));
        } catch (e) {
            console.error("Failed to save PID file", e);
        }
    }

    startProcess(project, bot, chatId) {
        if (this.processes[project.id] && this.processes[project.id].process) {
            return; // already running in this session
        }

        // Guard against orphaned processes from a previous MasterBot session.
        // If active_pids.json has a PID for this project, check if it's still alive.
        // If it is, we must not spawn a second instance (would cause 409 Telegram conflict).
        const savedPid = this.savedPids[project.id];
        if (savedPid) {
            const cp = require('child_process');
            try {
                // process.kill(pid, 0) throws if PID does not exist — Windows-safe via tasklist fallback
                const result = cp.spawnSync('tasklist', ['/FI', `PID eq ${savedPid}`, '/NH'], { encoding: 'utf8' });
                const isAlive = result.stdout && result.stdout.includes(String(savedPid));
                if (isAlive) {
                    if (bot && chatId) {
                        bot.sendMessage(chatId,
                            `⚠️ *${project.name}* appears to already be running (PID ${savedPid} from a previous session).\nUse /stop first, then /start.`,
                            { parse_mode: 'Markdown' }
                        ).catch(() => {});
                    }
                    console.warn(`[${project.id}] Blocked double-start: PID ${savedPid} is still alive.`);
                    return;
                }
            } catch (_) { /* tasklist unavailable — proceed with caution */ }
            // Stale PID — clean it up before spawning fresh
            this._removePid(project.id);
        }

        // Don't inherit parent env vars - let child load from its own .env
        const env = { ...process.env };
        delete env.TELEGRAM_BOT_TOKEN;  // Remove inherited token
        delete env.AUTHORIZED_CHAT_ID;  // Clear other bot config
        delete env.ADMIN_ID;

        const child = spawn(project.command, project.args || [], {
            cwd: project.path,
            shell: true,
            env: env  // Pass clean environment
        });

        child.on('error', (err) => {
            const errMsg = `❌ Failed to start *${project.name}*: ${err.message}`;
            if (bot && chatId) {
                bot.sendMessage(chatId, errMsg, { parse_mode: 'Markdown' }).catch(() => {});
            }
            console.error(`[${project.id}] Spawn error:`, err.message);
            this.processes[project.id].process = null;
            this._removePid(project.id);
        });

        const processData = {
            process: child,
            startTime: Date.now(),
            logs: [],
            autoRestart: this.processes[project.id] ? this.processes[project.id].autoRestart : false,
            tailing: this.processes[project.id] ? this.processes[project.id].tailing : false
        };

        if (!this.processes[project.id]) {
            this.processes[project.id] = processData;
        } else {
            this.processes[project.id].process = child;
            this.processes[project.id].startTime = Date.now();
        }

        this._savePid(project.id, child.pid);

        const handleOutput = (data, isError) => {
            const lines = data.toString().trim().split('\n');
            for (const line of lines) {
                if (!line) continue;
                const logLine = (isError ? '[ERR] ' : '') + line;
                processData.logs.push(logLine);
                if (processData.logs.length > 50) {
                    processData.logs.shift(); // keep last 50 lines max
                }
                if (processData.tailing && bot && chatId) {
                    // Warning: Can hit telegram rate limits if logs are too fast
                    // Better to batch, but for simple tail let's send directly or use a debouncer in practice
                    // For now, let's just send it. We'll add a simple throttling later if needed.
                    bot.sendMessage(chatId, `\`[${project.name}]\` ${logLine}`, { parse_mode: 'Markdown' }).catch(() => { });
                }
            }
        };

        child.stdout.on('data', (data) => handleOutput(data, false));
        child.stderr.on('data', (data) => handleOutput(data, true));

        child.on('close', (code) => {
            if (bot && chatId) {
                bot.sendMessage(chatId, `⚠️ Process *${project.name}* exited with code ${code}.`, { parse_mode: 'Markdown' }).catch(() => {});
            }
            this.processes[project.id].process = null;
            this._removePid(project.id);

            if (this.processes[project.id].autoRestart) {
                if (bot && chatId) {
                    bot.sendMessage(chatId, `🔄 Auto-restarting *${project.name}*...`, { parse_mode: 'Markdown' }).catch(() => {});
                }
                setTimeout(() => this.startProcess(project, bot, chatId), 2000); // Wait 2s before restarting
            }
        });
    }

    stopProcess(projectId) {
        return new Promise((resolve) => {
            if (this.processes[projectId] && this.processes[projectId].process) {
                // Temporarily disable auto-restart when intentionally stopping
                this.processes[projectId].autoRestart = false;

                const pid = this.processes[projectId].process.pid;
                const cp = require('child_process');
                cp.exec(`taskkill /pid ${pid} /T /F`, (err) => {
                    // We give it a moment to actually exit
                    setTimeout(() => {
                        this.processes[projectId].process = null;
                        this._removePid(projectId);
                        resolve();
                    }, 1000);
                });
            } else {
                resolve();
            }
        });
    }

    async restartProcess(project, bot, chatId) {
        await this.stopProcess(project.id);
        this.startProcess(project, bot, chatId);
    }

    getLogs(projectId, lines = 20) {
        if (this.processes[projectId]) {
            return this.processes[projectId].logs.slice(-lines);
        }
        return [];
    }

    clearLogs(projectId) {
        if (this.processes[projectId]) {
            this.processes[projectId].logs = [];
        }
    }

    toggleAutoRestart(projectId) {
        if (!this.processes[projectId]) {
            this.processes[projectId] = { autoRestart: false, tailing: false, logs: [] };
        }
        this.processes[projectId].autoRestart = !this.processes[projectId].autoRestart;
        return this.processes[projectId].autoRestart;
    }

    toggleTailing(projectId) {
        if (!this.processes[projectId]) {
            this.processes[projectId] = { autoRestart: false, tailing: false, logs: [] };
        }
        this.processes[projectId].tailing = !this.processes[projectId].tailing;
        return this.processes[projectId].tailing;
    }

    async getStatus(projectId) {
        const data = this.processes[projectId];
        if (!data || !data.process) return null;

        const uptime = Math.floor((Date.now() - data.startTime) / 1000);
        let stats = null;
        try {
            stats = await pidusage(data.process.pid);
        } catch (e) { }

        return {
            uptime,
            cpu: stats ? stats.cpu : 0,
            memory: stats ? stats.memory : 0,
            autoRestart: data.autoRestart,
            tailing: data.tailing
        };
    }

    isRunning(projectId) {
        return this.processes[projectId] && this.processes[projectId].process != null;
    }

}

module.exports = new ProcessManager();
