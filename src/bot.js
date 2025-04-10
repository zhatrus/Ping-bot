const { Telegraf } = require('telegraf');
const config = require('./config');
const db = require('./db');
const { pingAllIPs } = require('./ping');
const { setupHandlers } = require('./handlers');

let pingTask;

// Створюємо глобальний об'єкт бота
global.bot = null;

// Створюємо глобальний об'єкт для стану користувачів
global.userStates = new Map();

// Створюємо новий екземпляр бота
function createBot() {
  if (!config.BOT_TOKEN) {
    throw new Error('Не знайдено BOT_TOKEN в файлі .env');
  }
  return new Telegraf(config.BOT_TOKEN, config.BOT_CONFIG);
}

// Функція для очищення вебхуків та оновлень
async function cleanupBot() {
  try {
    const tempBot = createBot();
    await tempBot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('Вебхуки та оновлення очищено');
  } catch (error) {
    console.error('Помилка при очищенні:', error);
  }
}

// Функція для перезапуску бота
async function restartBot() {
  try {
    if (pingTask) {
      clearInterval(pingTask);
    }
    await global.bot.stop();
    console.log('Бот зупинений, очікуємо 5 секунд перед перезапуском...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await startBot();
  } catch (error) {
    console.error('Помилка при перезапуску бота:', error);
    process.exit(1);
  }
}

// Ініціалізація бота та запуск планувальника
async function startBot() {
  try {
    // Створюємо новий екземпляр бота
    global.bot = createBot();

    // Реєструємо обробники
    setupHandlers(global.bot);
    
    console.log('Бот запущено');
    
    // Запускаємо планувальник пінгування
    pingTask = setInterval(async () => {
      try {
        console.log('Запуск перевірки всіх IP...');
        await pingAllIPs();
      } catch (error) {
        console.error('Помилка при пінгуванні:', error);
      }
    }, config.PING_INTERVAL);

    // Очищуємо всі попередні оновлення
    await global.bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    // Запускаємо бота
    await global.bot.launch();
    
    console.log('Бот запущено');
  } catch (error) {
    console.error('Помилка запуску бота:', error);
    throw error;
  }
}

// Обробка завершення роботи
function setupShutdown() {
  process.once('SIGINT', () => {
    console.log('\nОтримано сигнал SIGINT (Ctrl+C)');
    if (pingTask) {
      console.log('Зупинка планувальника пінгування...');
      clearInterval(pingTask);
    }
    console.log('Зупинка бота...');
    global.bot.stop('SIGINT');
    process.exit(0);
  });

  process.once('SIGTERM', () => {
    console.log('\nОтримано сигнал SIGTERM');
    if (pingTask) {
      console.log('Зупинка планувальника пінгування...');
      clearInterval(pingTask);
    }
    console.log('Зупинка бота...');
    global.bot.stop('SIGTERM');
    process.exit(0);
  });
}

module.exports = {
  startBot,
  cleanupBot,
  restartBot,
  setupShutdown
};
