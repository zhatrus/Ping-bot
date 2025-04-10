const { startBot, cleanupBot, setupShutdown, restartBot } = require('./bot');

// Налаштовуємо обробку завершення роботи
setupShutdown();

// Запускаємо бота з очищенням сесії
cleanupBot().then(() => {
  startBot().catch(async error => {
    if (error.message.includes('terminated by other getUpdates request')) {
      console.log('Виявлено інший екземпляр бота. Спробуємо перезапустити...');
      await restartBot();
    } else {
      console.error('Помилка запуску бота:', error);
      process.exit(1);
    }
  });
});
