const { isUserAllowed, formatIPCard } = require('../utils');
const db = require('../db');
const { pingIP } = require('../ping');
const { showIPList } = require('./messages');

// Обробник дії пінгування IP
async function handlePingAction(ctx) {
  try {
    if (!isUserAllowed(ctx.chat.id)) {
      return await ctx.answerCbQuery('Доступ заборонено!').catch(err => {
        if (err.message.includes('query is too old')) {
          console.log('Ігноруємо застарілий callback query');
        } else {
          console.error('Помилка відповіді на callback:', err);
        }
      });
    }
    
    const ip = ctx.match[1];
    await ctx.answerCbQuery(`Перевіряємо ${ip}...`).catch(err => {
      if (err.message.includes('query is too old')) {
        console.log('Ігноруємо застарілий callback query');
      } else {
        console.error('Помилка відповіді на callback:', err);
      }
    });
    
    const result = await pingIP(ip);
    
    if (result.status === 'up') {
      await ctx.reply(`✅ IP ${ip} відповідає!\n⏱ Час відповіді: ${result.time} ms`);
    } else {
      await ctx.reply(`❌ IP ${ip} не відповідає!`);
    }
  } catch (error) {
    console.error('Помилка при обробці callback:', error);
    try {
      await ctx.answerCbQuery('Сталася помилка при перевірці').catch(() => {});
    } catch {}
  }
}

// Обробник дії видалення IP
async function handleDeleteAction(ctx) {
  try {
    if (!isUserAllowed(ctx.chat.id)) {
      return ctx.answerCbQuery('Доступ заборонено!');
    }
    
    const ip = ctx.callbackQuery.data.split('_')[1];
    const messageId = ctx.callbackQuery.message.message_id;
    
    // Видаляємо картку
    await ctx.deleteMessage(messageId);
    
    // Видаляємо IP з бази
    await db.removeIP(ip);
    await ctx.reply(`IP ${ip} успішно видалено!`);
  } catch (error) {
    console.error('Помилка при видаленні:', error);
    await ctx.reply('Сталася помилка при видаленні. Спробуйте пізніше.');
  }
}

// Обробник пінгування IP
async function handlePing(ctx) {
  try {
    if (!isUserAllowed(ctx.from.id)) {
      return ctx.reply('Доступ заборонено!');
    }
    
    const ip = ctx.callbackQuery.data.split('_')[1];
    const messageId = ctx.callbackQuery.message.message_id;
    
    // Видаляємо старе повідомлення
    await ctx.deleteMessage(messageId);
    
    // Відправляємо повідомлення про пінгування
    const statusMsg = await ctx.reply(`Пінгую ${ip}...`);
    
    // Пінгуємо IP з таймаутом
    const pingPromise = pingIP(ip);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Час очікування відповіді вийшов')), 10000);
    });
    
    await Promise.race([pingPromise, timeoutPromise]);
    
    // Отримуємо оновлені дані
    const ipData = await db.getIP(ip);
    if (!ipData) {
      throw new Error('Не вдалося знайти IP');
    }
    
    // Видаляємо повідомлення про пінгування
    await ctx.deleteMessage(statusMsg.message_id);
    
    // Відправляємо нову картку
    const card = formatIPCard(ipData);
    await ctx.reply(card.text, card.markup);
    
  } catch (error) {
    console.error('Помилка при пінгуванні:', error);
    await ctx.reply('Сталася помилка при пінгуванні. Спробуйте пізніше.');
  }
}

// Обробник додавання IP зі сповіщення
async function handleAddFromMessage(ctx) {
  try {
    if (!isUserAllowed(ctx.from.id)) {
      return ctx.reply('Доступ заборонено!');
    }
    
    const ip = ctx.callbackQuery.data.split('_')[1];
    const messageId = ctx.callbackQuery.message.message_id;
    
    // Видаляємо повідомлення з кнопкою
    await ctx.deleteMessage(messageId);
    
    // Додаємо IP до бази
    const result = await db.addIP(ip);
    
    if (result.success) {
      await ctx.reply(`IP ${ip} успішно додано до списку!`);
      await showIPList(ctx);
    } else {
      await ctx.reply(result.message);
    }
  } catch (error) {
    console.error('Помилка при додаванні:', error);
    await ctx.reply('Сталася помилка при додаванні IP. Спробуйте пізніше.');
  }
}

module.exports = {
  handlePingAction,
  handleDeleteAction,
  handlePing,
  handleAddFromMessage
};
