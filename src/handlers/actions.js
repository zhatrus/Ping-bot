const { isUserAllowed } = require('../utils');
const { pingIP } = require('../ping');
const db = require('../db');
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
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.answerCbQuery('Доступ заборонено!');
  }
  
  const ip = ctx.match[1];
  await db.removeIP(ip);
  await ctx.answerCbQuery(`IP ${ip} видалено`);
  await showIPList(ctx);
}

module.exports = {
  handlePingAction,
  handleDeleteAction
};
