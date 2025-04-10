const { isUserAllowed, isValidIP, formatIPCard } = require('../utils');
const db = require('../db');
const { pingIP } = require('../ping');

// Функція для відображення списку IP
async function showIPList(ctx) {
  try {
    const ips = await db.getAllIPs();
    
    if (ips.length === 0) {
      await ctx.reply('Список IP порожній. Додайте IP за допомогою команди /add');
      return;
    }
    
    for (const ipData of ips) {
      const card = formatIPCard(ipData);
      await ctx.reply(card.text, card.markup);
    }
  } catch (error) {
    console.error('Помилка при відображенні списку IP:', error);
    await ctx.reply('Сталася помилка при відображенні списку IP. Спробуйте пізніше.');
  }
}

// Обробник текстових повідомлень
async function handleMessage(ctx) {
  const userId = ctx.from.id;
  const userState = global.userStates.get(userId);
  
  if (!isUserAllowed(ctx.chat.id)) {
    return;
  }
  
  const text = ctx.message.text.trim();
  
  // Перевірка на команду /cancel
  if (text === '/cancel') {
    global.userStates.delete(userId);
    return await ctx.reply('Команду скасовано.');
  }
  
  if (!userState) return;
  
  if (userState.command === 'add') {
    if (userState.step === 'waiting_ip') {
      if (!isValidIP(text)) {
        return await ctx.reply('Невірний формат IP-адреси. Спробуйте ще раз або скасуйте команду /cancel');
      }
      
      userState.ip = text;
      userState.step = 'waiting_name';
      await ctx.reply('Введіть назву для цієї IP (або /skip, щоб пропустити, або /cancel для скасування):');
      
    } else if (userState.step === 'waiting_name') {
      let result;
      if (text === '/skip') {
        result = await db.addIP(userState.ip);
      } else {
        result = await db.addIP(userState.ip, text);
      }
      
      global.userStates.delete(userId);
      
      if (result.success) {
        await ctx.reply(text === '/skip' ? 
          `IP ${userState.ip} успішно додано!` :
          `IP ${userState.ip} з назвою "${text}" успішно додано!`
        );
        await pingIP(userState.ip);
        await showIPList(ctx);
      } else {
        await ctx.reply(result.message);
      }
    }
  }
}

module.exports = {
  showIPList,
  handleMessage
};
