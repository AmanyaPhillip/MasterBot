const processManager = require('./processManager');
const scheduler = require('./scheduler');
const config = require('./config.json');
const os = require('os');

const MAIN_KEYBOARD = {
    reply_markup: {
        keyboard: [
            [{ text: '📊 Visualize All Programs'  }],
            [{ text: '📋 List Programs' }, { text: '📅 Schedule' }],
            [{ text: '⚙️ Resources' }]
        ],
        resize_keyboard: true,
        persistent: true
    }
};

module.exports = function setupBot(bot) {
    // Set bot commands menu
    bot.setMyCommands([
        { command: 'start', description: 'Main menu / Restart bot' }
    ]);

    // Middleware to check admin
    const isAdmin = (msg) => {
        return msg.from.id === config.adminId || config.adminId === 0;
    };

    bot.onText(/\/start/, (msg) => {
        if (!isAdmin(msg)) return;
        bot.sendMessage(msg.chat.id, 'Welcome to the Process Manager Bot!', MAIN_KEYBOARD);
    });

    bot.on('message', (msg) => {
        if (!isAdmin(msg)) return;
        const text = msg.text || '';
        const chatId = msg.chat.id;

        if (text === '📋 List Programs' || text === '/list') {
            let options = {
                reply_markup: {
                    inline_keyboard: config.projects.map(p => {
                        return [{ text: `📂 ${p.name}`, callback_data: `menu_${p.id}` }];
                    })
                }
            };
            bot.sendMessage(chatId, 'Select a program to manage:', options);
        }

        if (text === '📊 Visualize All Programs' || text === '/status') {
            config.projects.forEach(p => sendProjectStatus(bot, chatId, p));
        }

        if (text === '⚙️ Resources' || text === '/resources') {
            const freeMem = os.freemem();
            const totalMem = os.totalmem();
            const usedMem = totalMem - freeMem;
            const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

            const createBar = (percent) => {
                const totalBlocks = 10;
                const filledBlocks = Math.round(percent / 10);
                return '█'.repeat(filledBlocks) + '░'.repeat(totalBlocks - filledBlocks);
            };

            let sysMsg = `🖥 *SYSTEM RESOURCES*\n`;
            sysMsg += `RAM: ${memPercent}% [${createBar(memPercent)}]\n`;
            sysMsg += `(${(usedMem / 1024 / 1024 / 1024).toFixed(1)}GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(1)}GB)\n\n`;
            sysMsg += `💡 *Active Programs:*`;

            bot.sendMessage(chatId, sysMsg, { parse_mode: 'Markdown' });

            config.projects.forEach(async p => {
                if (processManager.isRunning(p.id)) {
                    const status = await processManager.getStatus(p.id);
                    if (status) {
                        const cpuPercent = status.cpu.toFixed(1);
                        const ramMB = (status.memory / 1024 / 1024).toFixed(1);
                        const uptime = status.uptime > 60 ? `${(status.uptime / 60).toFixed(1)}m` : `${status.uptime}s`;

                        let pMsg = `\`[${p.name}]\`\n`;
                        pMsg += `CPU: ${cpuPercent}% [${createBar(cpuPercent)}]\n`;
                        pMsg += `RAM: ${ramMB} MB\n`;
                        pMsg += `Uptime: ${uptime}`;
                        bot.sendMessage(chatId, pMsg, { parse_mode: 'Markdown' });
                    }
                }
            });
        }

        if (text === '📅 Schedule' || text === '/schedule') {
            let options = {
                reply_markup: {
                    inline_keyboard: config.projects.map(p => {
                        return [{ text: `📅 ${p.name}`, callback_data: `sched_${p.id}` }];
                    })
                }
            };
            bot.sendMessage(chatId, 'Select a program to schedule:', options);
        }
    });

    bot.on('callback_query', async (query) => {
        if (!isAdmin(query)) {
            bot.answerCallbackQuery(query.id, { text: 'Unauthorized', show_alert: true });
            return;
        }
        const chatId = query.message.chat.id;
        const data = query.data;

        const [action, ...idParts] = data.split('_');
        const projectId = idParts.join('_');

        const project = config.projects.find(p => p.id === projectId);
        if (!project) return bot.answerCallbackQuery(query.id);

        try {
            if (action === 'menu') {
                bot.answerCallbackQuery(query.id);
                sendProjectStatus(bot, chatId, project);
            }
            else if (action === 'start') {
                if (processManager.isRunning(projectId)) {
                    bot.answerCallbackQuery(query.id, { text: 'Already running' });
                } else {
                    processManager.startProcess(project, bot, chatId);
                    bot.answerCallbackQuery(query.id, { text: 'Started' });
                    bot.sendMessage(chatId, `🚀 Started *${project.name}*`, { parse_mode: 'Markdown' });
                    // Refresh the status message if possible (we don't have message_id here easily without more logic, so just send a new one or let them refresh)
                }
            }
            else if (action === 'stop') {
                if (processManager.isRunning(projectId)) {
                    await processManager.stopProcess(projectId);
                    bot.answerCallbackQuery(query.id, { text: 'Stopped' });
                    bot.sendMessage(chatId, `🛑 Stopped *${project.name}*`, { parse_mode: 'Markdown' });
                } else {
                    bot.answerCallbackQuery(query.id, { text: 'Not running' });
                }
            }
            else if (action === 'gitpull') {
                bot.answerCallbackQuery(query.id, { text: 'Pulling...' });
                const { exec } = require('child_process');
                exec('git pull', { cwd: project.path }, (error, stdout, stderr) => {
                    if (error) {
                        bot.sendMessage(chatId, `❌ Git pull failed for *${project.name}*:\n\`\`\`\n${stderr || error.message}\n\`\`\``, { parse_mode: 'Markdown' });
                    } else {
                        bot.sendMessage(chatId, `✅ Git pull success for *${project.name}*:\n\`\`\`\n${stdout}\n\`\`\``, { parse_mode: 'Markdown' });
                    }
                });
            }
            else if (action === 'restart') {
                bot.answerCallbackQuery(query.id, { text: 'Restarting...' });
                await processManager.restartProcess(project, bot, chatId);
                bot.sendMessage(chatId, `🔄 Restarted *${project.name}*`, { parse_mode: 'Markdown' });
            }
            else if (action === 'logs') {
                bot.answerCallbackQuery(query.id);
                const logs = processManager.getLogs(projectId, 20);
                const logText = logs.length ? logs.join('\n') : "No logs available.";
                const finalTxt = logText.trim() === '' ? 'No logs.' : logText.trim();
                bot.sendMessage(chatId, `📄 *Logs for ${project.name}:*\n\`\`\`\n${finalTxt.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
            }
            else if (action === 'clear') {
                processManager.clearLogs(projectId);
                bot.answerCallbackQuery(query.id, { text: 'Logs cleared' });
                bot.sendMessage(chatId, `🧹 Logs cleared for *${project.name}*`, { parse_mode: 'Markdown' });
            }
            else if (action === 'autores') {
                const state = processManager.toggleAutoRestart(projectId);
                bot.answerCallbackQuery(query.id, { text: `Auto-restart: ${state ? 'ON' : 'OFF'}` });
                sendProjectStatus(bot, chatId, project);
            }
            else if (action === 'tail') {
                const state = processManager.toggleTailing(projectId);
                bot.answerCallbackQuery(query.id, { text: `Tailing: ${state ? 'ON' : 'OFF'}` });
                sendProjectStatus(bot, chatId, project);
            }
            else if (action === 'sched') {
                bot.answerCallbackQuery(query.id);
                sendScheduleOptions(bot, chatId, project);
            }
            else if (action === 'schedset') {
                const freq = idParts[0];
                const projId = idParts.slice(1).join('_');
                const proj = config.projects.find(p => p.id === projId);
                if (proj) {
                    scheduler.scheduleJob(projId, freq, bot);
                    bot.answerCallbackQuery(query.id, { text: `Scheduled: ${freq}` });
                    bot.sendMessage(chatId, `✅ *${proj.name}* scheduled: **${freq}** (6:00 AM)`, { parse_mode: 'Markdown' });
                }
            }
            else if (action === 'scheddel') {
                scheduler.removeSchedule(projectId);
                bot.answerCallbackQuery(query.id, { text: 'Schedule deleted' });
                bot.sendMessage(chatId, `🗑 Schedule removed for *${project.name}*`, { parse_mode: 'Markdown' });
            }
            else if (action === 'schedview') {
                const freq = scheduler.getSchedule(projectId);
                bot.answerCallbackQuery(query.id);
                bot.sendMessage(chatId, `📅 *${project.name}* Schedule:\n${freq ? `Frequency: **${freq}** (6:00 AM)` : 'No schedule set.'}`, { parse_mode: 'Markdown' });
            }
        } catch (e) {
            bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
            bot.sendMessage(chatId, `Error handling action: ${e.message}`);
        }
    });

};

async function sendProjectStatus(bot, chatId, project) {
    const isRunning = processManager.isRunning(project.id);
    let msg = `*${project.name}*\nStatus: ${isRunning ? '🟢 Running' : '🔴 Stopped'}`;

    // Get stats if running
    let stats = null;
    if (isRunning) {
        stats = await processManager.getStatus(project.id);
    } else {
        // Even if not running, we might have persistent settings in the manager
        // but let's just use defaults for now if not created yet
        stats = { autoRestart: false, tailing: false };
        // See if we can get settings from manager even if process is null
        if (processManager.processes[project.id]) {
            stats.autoRestart = processManager.processes[project.id].autoRestart;
            stats.tailing = processManager.processes[project.id].tailing;
        }
    }

    const auto = stats.autoRestart ? "✅" : "❌";
    const tail = stats.tailing ? "✅" : "❌";

    if (isRunning && stats.uptime !== undefined) {
        msg += `\nUptime: ${stats.uptime}s\nCPU: ${stats.cpu.toFixed(2)}%\nRAM: ${(stats.memory / 1024 / 1024).toFixed(2)} MB`;
    }

    const toggleLabel = isRunning ? '🛑 Stop' : '▶️ Start';
    const toggleAction = isRunning ? 'stop' : 'start';

    const keyboard = [
        [{ text: toggleLabel, callback_data: `${toggleAction}_${project.id}` }, { text: '🔄 Restart', callback_data: `restart_${project.id}` }],
        [{ text: '📄 View Output', callback_data: `logs_${project.id}` }, { text: '🧹 Clear Logs', callback_data: `clear_${project.id}` }],
        [{ text: `🔄 Auto-Restart: ${auto}`, callback_data: `autores_${project.id}` }],
        [{ text: `📝 Log Tailing: ${tail}`, callback_data: `tail_${project.id}` }],
        [{ text: '⬇️ Git Pull', callback_data: `gitpull_${project.id}` }]
    ];

    bot.sendMessage(chatId, msg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
}

function sendScheduleOptions(bot, chatId, project) {
    const keyboard = [
        [{ text: '🌅 Daily', callback_data: `schedset_daily_${project.id}` }, { text: '📅 Weekly', callback_data: `schedset_weekly_${project.id}` }],
        [{ text: '🗓 Biweekly', callback_data: `schedset_biweekly_${project.id}` }, { text: '🌚 Monthly', callback_data: `schedset_monthly_${project.id}` }],
        [{ text: '🔍 View Current', callback_data: `schedview_${project.id}` }],
        [{ text: '🗑 Remove Schedule', callback_data: `scheddel_${project.id}` }]
    ];

    bot.sendMessage(chatId, `Select frequency for *${project.name}*:`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
}
