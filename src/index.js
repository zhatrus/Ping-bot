const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
const cron = require('node-cron');

let pingTask;

const db = require('./db');
const { pingIP, pingAllIPs } = require('./ping');
const { isUserAllowed, notifyAdmins, isValidIP, formatIPCard, bot } = require('./utils');

// Стан користувачів
const userStates = new Map();

// Ініціалізація бази даних та запуск планувальника
async function startBot() {
  try {
    await db.initDB();
    console.log('База даних ініціалізована');
    
    // Запускаємо планувальник пінгування кожні 5 хвилин
    pingTask = cron.schedule('*/5 * * * *', async () => {
      console.log('Запуск перевірки всіх IP...');
      await pingAllIPs();
    });

    // Запускаємо бота
    await bot.launch();
    console.log('Бот запущено');
  } catch (error) {
    console.error('Помилка запуску бота:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\nОтримано сигнал SIGINT (Ctrl+C)');
  if (pingTask) {
    console.log('Зупинка планувальника пінгування...');
    pingTask.stop();
  }
  console.log('Зупинка бота...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('\nОтримано сигнал SIGTERM');
  if (pingTask) {
    console.log('Зупинка планувальника пінгування...');
    pingTask.stop();
  }
  console.log('Зупинка бота...');
  bot.stop('SIGTERM');
  process.exit(0);
});

// Запускаємо бота
startBot();

// Обробник команди /start
bot.start(async (ctx) => {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }
  
  await ctx.reply(
    '👋 Вітаю! Це бот для моніторингу IP-адрес.\n\n' +
    'Доступні команди:\n' +
    '/ip - Список всіх IP\n' +
    '/add - Додати нову IP\n' +
    '/help - Довідка'
  );
  
  // Показуємо список IP після старту
  ctx.reply('Ось список ваших IP:');
  await showIPList(ctx);
});

// Обробник команди /cancel
bot.command('cancel', async (ctx) => {
  const userId = ctx.from.id;
  if (userStates.has(userId)) {
    userStates.delete(userId);
    await ctx.reply('Команду скасовано.');
  } else {
    await ctx.reply('Немає активної команди для скасування.');
  }
});

// Обробник команди /ip
bot.command('ip', async (ctx) => {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }
  
  await showIPList(ctx);
});

// Обробник команди /add
bot.command('add', async (ctx) => {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }
  
  const userId = ctx.from.id;
  userStates.set(userId, { command: 'add', step: 'waiting_ip' });
  await ctx.reply('Введіть IP-адресу для додавання (або /cancel для скасування):');
});

// Обробник текстових повідомлень
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);
  
  if (!userState) return; // Немає активного стану
  
  const text = ctx.message.text.trim();
  
  // Перевірка на команду /cancel
  if (text === '/cancel') {
    userStates.delete(userId);
    return await ctx.reply('Команду скасовано.');
  }
  
  if (userState.command === 'add') {
    if (userState.step === 'waiting_ip') {
      if (!isValidIP(text)) {
        return await ctx.reply('Невірний формат IP-адреси. Спробуйте ще раз або скасуйте команду /cancel');
      }
      
      userState.ip = text;
      userState.step = 'waiting_name';
      await ctx.reply('Введіть назву для цієї IP (або /skip, щоб пропустити, або /cancel для скасування):');
      
    } else if (userState.step === 'waiting_name') {
      if (text === '/skip') {
        const result = await db.addIP(userState.ip);
        userStates.delete(userId);
        
        if (result.success) {
          await ctx.reply(`IP ${userState.ip} успішно додано!`);
          await pingIP(userState.ip);
          await showIPList(ctx);
        } else {
          await ctx.reply(result.message);
        }
      } else {
        const result = await db.addIP(userState.ip, text);
        userStates.delete(userId);
        
        if (result.success) {
          await ctx.reply(`IP ${userState.ip} з назвою "${text}" успішно додано!`);
          await pingIP(userState.ip);
          await showIPList(ctx);
        } else {
          await ctx.reply(result.message);
        }
      }
    }
  }
});

// Функція для відображення списку IP
async function showIPList(ctx) {
  const ips = await db.getAllIPs();
  
  if (ips.length === 0) {
    return ctx.reply('Список IP порожній. Додайте IP командою /add');
  }
  
  for (const ipData of ips) {
    const message = formatIPCard(ipData);
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Перевірити', `ping_${ipData.ip}`),
        Markup.button.callback('❌ Видалити', `delete_${ipData.ip}`)
      ],
      [
        Markup.button.callback('✏️ Змінити назву', `rename_${ipData.ip}`)
      ]
    ]);
    
    await ctx.reply(message, keyboard);
  }
}

// Обробник кнопки "Перевірити"
bot.action(/ping_(.+)/, async (ctx) => {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.answerCbQuery('Доступ заборонено!');
  }
  
  const ip = ctx.match[1];
  await ctx.answerCbQuery(`Перевіряємо ${ip}...`);
  
  const result = await pingIP(ip);
  if (result.status === 'up') {
    await ctx.reply(`✅ IP ${ip} відповідає (ping: ${result.time}ms)`);
  } else {
    await ctx.reply(`❌ IP ${ip} не відповідає`);
  }
  
  // Оновлюємо повідомлення зі списком
  await ctx.deleteMessage();
  await showIPList(ctx);
});

// Обробник кнопки "Видалити"
bot.action(/delete_(.+)/, async (ctx) => {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.answerCbQuery('Доступ заборонено!');
  }
  
  const ip = ctx.match[1];
  await db.removeIP(ip);
  await db.removeError(ip); // Видаляємо з помилок, якщо була там
  
  await ctx.answerCbQuery(`IP ${ip} видалено`);
  await ctx.deleteMessage();
  await showIPList(ctx);
});

// Обробник кнопки "Змінити назву"
bot.action(/rename_(.+)/, async (ctx) => {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.answerCbQuery('Доступ заборонено!');
  }
  
  const ip = ctx.match[1];
  await ctx.answerCbQuery(`Введіть нову назву для ${ip}`);
  
  // Очікуємо нову назву
  bot.on('text', async (ctx) => {
    const newName = ctx.message.text.trim();
    await db.updateIPName(ip, newName);
    await ctx.reply(`Назву для ${ip} змінено на "${newName}"`);
    await ctx.deleteMessage();
    await showIPList(ctx);
  });
});

// Обробник помилок
bot.catch((err, ctx) => {
  console.error(`Помилка для ${ctx.updateType}:`, err);
  if (ctx.chat) {
    ctx.reply('Виникла помилка при обробці запиту');
  }
});

// Запускаємо регулярне пінгування
cron.schedule('* * * * *', async () => {
  console.log('Запускаємо регулярне пінгування всіх IP...');
  await pingAllIPs();
});

// Запуск бота
startBot().catch(error => {
  console.error('Помилка при запуску бота:', error);
  process.exit(1);
});

// Обробка завершення роботи вже налаштована вище
process.once('SIGTERM', () => bot.stop('SIGTERM'));