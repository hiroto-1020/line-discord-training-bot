require('dotenv').config();

const axios = require('axios');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL;
const GAS_SECRET_KEY = process.env.GAS_SECRET_KEY;

if (!DISCORD_BOT_TOKEN || !GAS_WEB_APP_URL || !GAS_SECRET_KEY) {
  console.error('環境変数が不足しています。.envを確認してください。');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`Discord Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const content = message.content?.trim();
    if (!content) return;

    const firstLine = content.split('\n')[0].trim();

    if (!isDateLine(firstLine)) {
      console.log('日付行ではないためスキップ:', firstLine);
      return;
    }

    console.log('トレーニング記録を検知:', firstLine);

    const payload = {
      secret: GAS_SECRET_KEY,
      discord_channel_id: message.channel.id,
      message_id: message.id,
      content: content,
      created_at: message.createdAt.toISOString()
    };

    const response = await axios.post(GAS_WEB_APP_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('スプレッドシート転記結果:', response.data);
  } catch (error) {
    console.error('転記エラー:', error.response?.data || error.message);
  }
});

function isDateLine(text) {
  const normalized = String(text)
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/／/g, '/')
    .trim();

  return /^(\d{1,2})[\/月](\d{1,2})日?$/.test(normalized);
}

client.login(DISCORD_BOT_TOKEN);