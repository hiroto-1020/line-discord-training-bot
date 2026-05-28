require('dotenv').config();

const axios = require('axios');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_CATEGORY_ID = process.env.DISCORD_CATEGORY_ID || '';
const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL;
const GAS_SECRET_KEY = process.env.GAS_SECRET_KEY;

if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !GAS_WEB_APP_URL || !GAS_SECRET_KEY) {
  console.error('必要な環境変数が不足しています。');
  console.error({
    hasDiscordBotToken: Boolean(DISCORD_BOT_TOKEN),
    hasDiscordGuildId: Boolean(DISCORD_GUILD_ID),
    hasGasWebAppUrl: Boolean(GAS_WEB_APP_URL),
    hasGasSecretKey: Boolean(GAS_SECRET_KEY),
  });
  process.exit(1);
}

const discordHeaders = {
  Authorization: `Bot ${DISCORD_BOT_TOKEN.replace(/^Bot\s+/i, '').trim()}`,
  'User-Agent': 'DiscordBot (https://github.com/hiroto-1020/line-discord-training-bot, 1.0)',
  Accept: 'application/json',
};

async function main() {
  console.log('Discord同期開始');

  const channels = await fetchDiscordChannels();

  const targetChannels = channels.filter((channel) => {
    const isTextChannel = channel.type === 0;
    if (!isTextChannel) return false;

    if (DISCORD_CATEGORY_ID) {
      return String(channel.parent_id || '') === String(DISCORD_CATEGORY_ID);
    }

    return true;
  });

  console.log(`対象チャンネル数: ${targetChannels.length}`);

  let postedCount = 0;
  let skippedCount = 0;

  for (const channel of targetChannels) {
    const messages = await fetchDiscordMessages(channel.id, 30);

    // 古い順に送る
    messages.reverse();

    for (const message of messages) {
      if (!message.content) {
        skippedCount++;
        continue;
      }

      if (message.author?.bot) {
        skippedCount++;
        continue;
      }

      const content = String(message.content).trim();
      const firstLine = content.split('\n')[0].trim();

      if (!isDateLine(firstLine)) {
        skippedCount++;
        continue;
      }

      const payload = {
        secret: GAS_SECRET_KEY,
        discord_channel_id: String(channel.id),
        discord_channel_name: String(channel.name || '未登録'),
        message_id: String(message.id),
        content,
        created_at: message.timestamp || new Date().toISOString(),
      };

      const result = await postToGas(payload);

      if (result.ok && !result.skipped) {
        postedCount++;
        console.log(`保存成功: ${channel.name} / ${firstLine}`);
      } else {
        skippedCount++;
        console.log(`スキップ: ${channel.name} / ${firstLine} / ${result.reason || result.error || 'unknown'}`);
      }
    }
  }

  console.log(`Discord同期完了: 保存 ${postedCount}件 / スキップ ${skippedCount}件`);
}

async function fetchDiscordChannels() {
  const url = `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/channels`;

  const response = await axios.get(url, {
    headers: discordHeaders,
  });

  return response.data;
}

async function fetchDiscordMessages(channelId, limit = 30) {
  try {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`;

    const response = await axios.get(url, {
      headers: discordHeaders,
    });

    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    console.log(`メッセージ取得失敗: channel=${channelId} status=${status}`, data);
    return [];
  }
}

async function postToGas(payload) {
  const response = await axios.post(GAS_WEB_APP_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  return response.data;
}

function isDateLine(text) {
  const normalized = String(text || '')
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/／/g, '/')
    .trim();

  return /^(\d{1,2})[\/月](\d{1,2})日?$/.test(normalized);
}

main().catch((error) => {
  console.error('同期エラー:', error.response?.data || error.message);
  process.exit(1);
});