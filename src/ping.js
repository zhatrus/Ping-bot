const ping = require('ping');
const db = require('./db');
const { notifyAdmins } = require('./utils');

// Функція для пінгування IP
async function pingIP(ip) {
  try {
    // Спочатку перевіряємо чи є IP в базі
    const ipData = await db.getIP(ip);
    if (!ipData) {
      throw new Error(`IP ${ip} не знайдено в списку`);
    }

    const res = await ping.promise.probe(ip, {
      timeout: 5,  // Таймаут 5 секунд
      min_reply: 1,  // Мінімум 1 відповідь
      extra: [
        '-n', '2',  // 2 спроби
        '-w', '5000'  // Таймаут 5 секунд
      ]
    });
    
    const isAlive = res.alive;
    const responseTime = isAlive ? parseFloat(res.time) : null;
    
    // Оновлюємо статус в базі даних
    const updateResult = await db.updateIPStatus(ip, isAlive ? 'up' : 'down', responseTime);
    if (!updateResult || updateResult.success === false) {
      throw new Error(updateResult?.message || 'Не вдалося оновити статус IP');
    }
    
    // Обробляємо зміну статусу
    if (isAlive) {
      // Якщо IP знову онлайн, перевіряємо чи була помилка
      const hadError = await db.removeError(ip);
      if (hadError && updateResult.downtime) {
        const downtimeMinutes = Math.floor(updateResult.downtime / (1000 * 60));
        const ipData = await db.getIP(ip);
        const ipName = ipData && ipData.name ? ` (${ipData.name})` : '';
        const message = `🟢 IP ${ip}${ipName} знову онлайн!\n` +
                       `⏱ Час простою: ${downtimeMinutes} хвилин`;
        await notifyAdmins(message, global.bot);
      }
    } else {
      // Якщо IP офлайн, додаємо до журналу помилок
      const added = await db.addError(ip);
      if (added) {
        const ipData = await db.getIP(ip);
        const ipName = ipData && ipData.name ? ` (${ipData.name})` : '';
        const message = `🔴 IP ${ip}${ipName} не відповідає!`;
        await notifyAdmins(message, global.bot);
      }
    }
    
    return {
      ip,
      status: isAlive ? 'up' : 'down',
      time: responseTime
    };
  } catch (error) {
    console.error(`Помилка пінгування ${ip}:`, error);
    return {
      ip,
      status: 'error',
      error: error.message
    };
  }
}

// Пінгування всіх IP
async function pingAllIPs() {
  try {
    const ips = await db.getAllIPs();
    const results = [];
    
    for (const ipData of ips) {
      try {
        const result = await pingIP(ipData.ip);
        results.push(result);
      } catch (error) {
        console.error(`Помилка при пінгуванні ${ipData.ip}:`, error);
        results.push({
          ip: ipData.ip,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Помилка при отриманні списку IP:', error);
    throw error;
  }
}

module.exports = {
  pingIP,
  pingAllIPs
};