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
  
  if (!userState) {
    // Перевіряємо чи це IP-адреса
    if (isValidIP(text)) {
      try {
        // Спочатку пінгуємо
        const statusMsg = await ctx.reply(`Пінгую ${text}...`);
        
        try {
          const result = await pingIP(text);
          await ctx.deleteMessage(statusMsg.message_id);
          
          if (result.status === 'up') {
            await ctx.reply(`✅ IP ${text} відповідає!\n⏰ Час відповіді: ${result.time} ms`);
          } else {
            await ctx.reply(`❌ IP ${text} не відповідає!`);
          }
          
          // Перевіряємо чи є ця IP в базі
          const ips = await db.getAllIPs();
          const exists = ips.some(ip => ip.ip === text);
          
          if (!exists) {
            // Якщо IP немає в базі, пропонуємо додати
            const markup = {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '➕ Додати до списку', callback_data: `add_${text}` }]
                ]
              }
            };
            await ctx.reply('Хочете додати цю IP до списку моніторингу?', markup);
          }
        } catch (error) {
          await ctx.deleteMessage(statusMsg.message_id);
          await ctx.reply('Сталася помилка при пінгуванні. Спробуйте пізніше.');
        }
      } catch (error) {
        console.error('Помилка:', error);
        await ctx.reply('Сталася помилка. Спробуйте пізніше.');
      }
      return;
    }
    return;
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
      try {
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
          
          try {
            await pingIP(userState.ip);
          } catch (pingError) {
            console.error('Помилка при пінгуванні:', pingError);
          }
          
          try {
            await showIPList(ctx);
          } catch (listError) {
            console.error('Помилка при відображенні списку:', listError);
            await ctx.reply('Не вдалося показати список IP. Спробуйте команду /ip');
          }
        } else {
          await ctx.reply(result.message);
        }
      } catch (error) {
        console.error('Помилка при додаванні IP:', error);
        await ctx.reply('Сталася помилка при додаванні IP. Спробуйте ще раз.');
        global.userStates.delete(userId);
      }
    }
  }
}

module.exports = {
  showIPList,
  handleMessage
};
