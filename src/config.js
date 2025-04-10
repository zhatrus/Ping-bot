require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  PING_INTERVAL: parseInt(process.env.PING_INTERVAL) || 60000, // За замовчуванням 60 секунд
  BOT_CONFIG: {
    handlerTimeout: 90_000, // 90 секунд таймаут
    telegram: {
      timeout: 30_000, // 30 секунд таймаут для API запитів
      apiRoot: 'https://api.telegram.org'
    }
  }
};
