require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  PING_INTERVAL: '*/5 * * * *', // Кожні 5 хвилин
  BOT_CONFIG: {
    handlerTimeout: 90_000, // 90 секунд таймаут
    telegram: {
      timeout: 30_000, // 30 секунд таймаут для API запитів
      apiRoot: 'https://api.telegram.org'
    }
  }
};
