const { handleStart, handleCancel, handleIp, handleAdd, handleDel } = require('./commands');
const { handlePing, handleDeleteAction, handleAddFromMessage, handleCancelAdd, handleRename, handleCancelDelete, handlePingAction } = require('./actions');
const { handleMessage } = require('./messages');

function setupHandlers(bot) {
  // Команди
  bot.start(handleStart);
  bot.command('cancel', handleCancel);
  bot.command('ip', handleIp);
  bot.command('add', handleAdd);
  bot.command('del', handleDel);

  // Дії (callback queries)
  bot.action(/^ping_(.+)$/, handlePing);
  bot.action(/^delete_(.+)$/, handleDeleteAction);
  bot.action(/^rename_(.+)$/, handleRename);
  bot.action(/^add_(.+)$/, handleAddFromMessage);
  bot.action('cancel_add', handleCancelAdd);
  bot.action('cancel_delete', handleCancelDelete);

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
