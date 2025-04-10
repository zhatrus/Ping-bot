const { isUserAllowed } = require('../utils');
const { showIPList } = require('./messages');
const db = require('../db');

// Обробник команди /start
async function handleStart(ctx) {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }
  
  await ctx.reply(
    '👋 Вітаю! Це бот для моніторингу IP-адрес.\n\n' +
    'Доступні команди:\n' +
    '/ip - Список всіх IP\n' +
    '/add - Додати нову IP\n' +
    '/del - Видалити IP\n' +
    '/help - Довідка'
  );
  
  ctx.reply('Ось список ваших IP:');
  await showIPList(ctx);
}

// Обробник команди /cancel
async function handleCancel(ctx) {
  const userId = ctx.from.id;
  if (global.userStates.has(userId)) {
    global.userStates.delete(userId);
    await ctx.reply('Команду скасовано.');
  } else {
    await ctx.reply('Немає активної команди для скасування.');
  }
}

// Обробник команди /ip
async function handleIp(ctx) {
  try {
    if (!isUserAllowed(ctx.chat.id)) {
      return ctx.reply('Доступ заборонено!');
    }
    await showIPList(ctx);
  } catch (error) {
    console.error('Помилка при відображенні списку IP:', error);
    await ctx.reply('Сталася помилка при відображенні списку IP. Спробуйте пізніше.');
  }
}

// Обробник команди /add
async function handleAdd(ctx) {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }
  global.userStates.set(ctx.from.id, {
    command: 'add',
    step: 'waiting_ip'
  });
  await ctx.reply('Введіть IP-адресу для моніторингу:');
}

// Обробник команди /del
async function handleDel(ctx) {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }

  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ');
  
  // Якщо команда введена без аргументів, показуємо інтерактивний список
  if (args.length < 2) {
    try {
      const ips = db.getAllIPs();
      
      if (ips.length === 0) {
        return ctx.reply('Список IP порожній.');
      }
      
      await ctx.reply('Виберіть IP для видалення:');
      
      // Для кожного IP створюємо окреме повідомлення з кнопкою видалення
      for (const ipData of ips) {
        const ipName = ipData.name ? ` (${ipData.name})` : '';
        const ipStatus = ipData.status === 'up' ? '🟢' : '🔴';
        const ipText = `${ipStatus} ${ipData.ip}${ipName}`;
        
        await ctx.reply(ipText, {
          reply_markup: {
            inline_keyboard: [
              [{
                text: '🗑️ Видалити',
                callback_data: `delete_${ipData.ip}`
              }]
            ]
          }
        });
      }
      
      // Додаємо пояснення та кнопку Скасувати
      return ctx.reply('Натисніть на кнопку "Видалити" для потрібного IP', {
        reply_markup: {
          inline_keyboard: [
            [{
              text: '🔙 Скасувати',
              callback_data: 'cancel_delete'
            }]
          ]
        }
      });
      
    } catch (error) {
      console.error('Помилка при отриманні списку IP:', error);
      return ctx.reply('❌ Сталася помилка при отриманні списку IP');
    }
  }

  // Якщо команда введена з аргументом, видаляємо конкретний IP
  const ip = args[1];
  
  try {
    const result = db.removeIP(ip);
    if (result) {
      await ctx.reply(`✅ IP ${ip} успішно видалено`);
    } else {
      await ctx.reply(`❌ Помилка: IP ${ip} не знайдено в списку`);
    }
  } catch (error) {
    console.error('Помилка при видаленні IP:', error);
    await ctx.reply('❌ Сталася помилка при видаленні IP');
  }
}

module.exports = {
  handleStart,
  handleCancel,
  handleIp,
  handleAdd,
  handleDel
};
