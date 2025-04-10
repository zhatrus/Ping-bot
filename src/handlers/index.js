const { handleStart, handleCancel, handleIp, handleAdd } = require('./commands');
const { handlePing, handleDeleteAction } = require('./actions');
const { handleMessage } = require('./messages');

function setupHandlers(bot) {
  // Команди
  bot.start(handleStart);
  bot.command('cancel', handleCancel);
  bot.command('ip', handleIp);
  bot.command('add', handleAdd);

  // Дії (callback queries)
  bot.action(/^ping_(.+)$/, handlePing);
  bot.action(/^delete_(.+)$/, handleDeleteAction);

  // Текстові повідомлення
  bot.on('text', handleMessage);

  // Обробник помилок
  bot.catch((error, ctx) => {
    console.error('Помилка в обробнику:', error);
    if (ctx) {
      ctx.reply('Сталася помилка. Спробуйте пізніше.').catch(() => {});
    }
  });
}

module.exports = {
  setupHandlers
};
