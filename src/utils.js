const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const allowedChatIds = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());

// Перевірка чи користувач має доступ
function isUserAllowed(chatId) {
  return allowedChatIds.includes(chatId.toString());
}

// Відправка повідомлення всім адмінам
async function notifyAdmins(message) {
  for (const chatId of allowedChatIds) {
    try {
      await bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      console.error(`Помилка відправки повідомлення до ${chatId}:`, error);
    }
  }
}

// Валідація IP-адреси
function isValidIP(ip) {
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// Форматування картки IP для відображення
function formatIPCard(ipData) {
  const name = ipData.name || 'Без назви';
  const statusEmoji = ipData.status === 'up' ? '🟢' : ipData.status === 'down' ? '🔴' : '⚪';
  
  let uptimeInfo = '';
  if (ipData.date_stop) {
    const downtime = Math.floor((new Date() - new Date(ipData.date_stop)) / (1000 * 60));
    uptimeInfo = `\n⏱ Час простою: ${downtime} хв`;
  }
  
  return `📌 ${name}\n` +
         `🔗 ${ipData.ip}\n` +
         `📅 Зареєстровано: ${new Date(ipData.date_start).toLocaleString()}\n` +
         `🔄 Остання перевірка: ${new Date(ipData.date_last).toLocaleString()}\n` +
         `📊 Стан: ${statusEmoji} ${ipData.status}\n` +
         uptimeInfo;
}

module.exports = {
  isUserAllowed,
  notifyAdmins,
  isValidIP,
  formatIPCard,
  bot
};