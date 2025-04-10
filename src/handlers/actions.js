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

// Обробник відмови від додавання IP
async function handleCancelAdd(ctx) {
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (error) {
    console.error('Помилка при видаленні повідомлення:', error);
  }
}

// Обробник дії видалення IP
async function handleDeleteAction(ctx) {
  try {
    if (!isUserAllowed(ctx.chat.id)) {
      return ctx.answerCbQuery('Доступ заборонено!').catch(err => {
        if (err.message.includes('query is too old')) {
          console.log('Ігноруємо застарілий callback query');
        } else {
          console.error('Помилка відповіді на callback:', err);
        }
      });
    }
    
    const ip = ctx.callbackQuery.data.split('_')[1];
    
    // Повідомляємо користувача про початок видалення
    await ctx.answerCbQuery(`Видаляю IP ${ip}...`).catch(err => {
      if (err.message.includes('query is too old')) {
        console.log('Ігноруємо застарілий callback query');
      } else {
        console.error('Помилка відповіді на callback:', err);
      }
    });
    
    // Видаляємо IP з бази
    const result = db.removeIP(ip);
    
    if (result) {
      // Видалити всі повідомлення з кнопками видалення
      try {
        // Спробуємо видалити повідомлення, з якого викликана команда
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
      } catch (e) {
        console.log('Не вдалося видалити повідомлення');
      }
      
      await ctx.reply(`✅ IP ${ip} успішно видалено!`);
    } else {
      await ctx.reply(`❌ Помилка: IP ${ip} не знайдено в списку`);
    }
  } catch (error) {
    console.error('Помилка при видаленні:', error);
    await ctx.reply('❌ Сталася помилка при видаленні. Спробуйте пізніше.');
  }
}

// Обробник скасування видалення IP
async function handleCancelDelete(ctx) {
  try {
    await ctx.answerCbQuery('Видалення скасовано').catch(err => {
      if (err.message.includes('query is too old')) {
        console.log('Ігноруємо застарілий callback query');
      } else {
        console.error('Помилка відповіді на callback:', err);
      }
    });
    
    // Видаляємо всі повідомлення з кнопками видалення
    if (global.deleteMessages && global.deleteMessages.length > 0) {
      for (const messageId of global.deleteMessages) {
        try {
          await ctx.deleteMessage(messageId).catch(() => {});
        } catch (e) {
          console.log('Не вдалося видалити повідомлення', messageId);
        }
      }
      // Очищуємо масив повідомлень
      global.deleteMessages = [];
    }
    
    // Відправляємо повідомлення про успішне скасування
    const msg = await ctx.reply('✅ Видалення скасовано.');
    
    // Видаляємо повідомлення про успіх через 3 секунди
    setTimeout(async () => {
      try {
        await ctx.deleteMessage(msg.message_id).catch(() => {});
      } catch (e) {
        console.log('Не вдалося видалити повідомлення про успіх');
      }
    }, 3000);
    
  } catch (error) {
    console.error('Помилка при скасуванні видалення:', error);
    await ctx.reply('❌ Сталася помилка при скасуванні видалення.');
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
    
    try {
      // Пінгуємо IP з таймаутом
      const pingPromise = pingIP(ip);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Час очікування відповіді вийшов')), 15000); // Збільшуємо до 15 секунд
      });
      
      await Promise.race([pingPromise, timeoutPromise]);
      
      // Отримуємо оновлені дані про IP
      const ipData = await db.getIP(ip);
      if (!ipData) {
        throw new Error('Не вдалося знайти IP');
      }
      
      // Видаляємо повідомлення про пінгування
      await ctx.deleteMessage(statusMsg.message_id);
      
      // Формуємо та відправляємо картку IP
      const card = formatIPCard(ipData);
      await ctx.reply(card.text, { ...card.markup, parse_mode: 'HTML' });
    } catch (error) {
      console.error('Помилка при пінгуванні:', error);
      await ctx.reply('Сталася помилка при пінгуванні. Спробуйте пізніше.');
    }
    
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

// Обробник для зміни назви IP
async function handleRename(ctx) {
  const ip = ctx.match[1];
  const userId = ctx.from.id;
  
  try {
    global.userStates.set(userId, { action: 'rename', ip });
    await ctx.reply('✒️ Введіть нову назву для IP ' + ip);
  } catch (error) {
    console.error('Помилка при зміні назви IP:', error);
    await ctx.reply('❌ Сталася помилка при зміні назви IP');
  }
}

module.exports = {
  handlePing,
  handleDeleteAction,
  handleAddFromMessage,
  handleCancelAdd,
  handleRename,
  handleCancelDelete,
  handlePingAction
};
