require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const config = require('../config.json');
const setupBot = require('./botHandlers');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = Number(process.env.ADMIN_ID);

if (!token) {
    console.error("FATAL: TELEGRAM_BOT_TOKEN is not set in .env");
    process.exit(1);
}

if (!Number.isInteger(adminId) || adminId <= 0) {
    console.error("FATAL: ADMIN_ID must be your numeric Telegram user id (a positive integer)");
    process.exit(1);
}

// Project ids are used as a ':'-delimited callback-data segment, so they must not contain ':'
const badIds = (config.projects || []).filter(p => !p.id || String(p.id).includes(':'));
if (badIds.length) {
    console.error(
        "FATAL: every project needs a non-empty id with no ':' character. Offending entries:",
        badIds.map(p => p.name || JSON.stringify(p))
    );
    process.exit(1);
}

config.token = token;
config.adminId = adminId;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

const scheduler = require('./scheduler');

console.log('Bot is starting up...');

setupBot(bot);
scheduler.resumeAll(bot);

console.log('Bot is running and listening for messages.');
