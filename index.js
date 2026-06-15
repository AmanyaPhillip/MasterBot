require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config.json');
const setupBot = require('./botHandlers');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = parseInt(process.env.ADMIN_ID);

if (!token) {
    console.error("Please set TELEGRAM_BOT_TOKEN in .env file.");
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
