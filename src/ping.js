const ping = require('ping');
const db = require('./db');
const { notifyAdmins } = require('./utils');

// Функція для пінгування IP
async function pingIP(ip) {
  try {
    const res = await ping.promise.probe(ip, {
      timeout: 5,
      min_reply: 3,  // Мінімум 3 відповіді
      extra: [
        '-n', '4',  // 4 спроби для Windows
        '-w', '5000'  // Таймаут 5 секунд для Windows
      ]
    });
    
    const isAlive = res.alive;
    const updateResult = await db.updateIPStatus(ip, isAlive ? 'up' : 'down');
    
    if (isAlive) {
      // Якщо IP знову онлайн, перевіряємо чи була помилка
      const hadError = await db.removeError(ip);
      if (hadError && updateResult.downtime) {
        const downtimeMinutes = Math.floor(updateResult.downtime / (1000 * 60));
        const message = `🟢 IP ${ip} знову онлайн!\n` +
                       `⏱ Час простою: ${downtimeMinutes} хвилин`;
        await notifyAdmins(message);
      }
    } else {
      // Якщо IP офлайн, додаємо до журналу помилок
      const added = await db.addError(ip);
      if (added) {
        const message = `🔴 IP ${ip} не відповідає!`;
        await notifyAdmins(message);
      }
    }
    
    return {
      ip,
      status: isAlive ? 'up' : 'down',
      time: isAlive ? res.time : null
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
  const ips = await db.getAllIPs();
  const results = [];
  
  for (const ipData of ips) {
    const result = await pingIP(ipData.ip);
    results.push(result);
  }
  
  return results;
}

module.exports = {
  pingIP,
  pingAllIPs
};