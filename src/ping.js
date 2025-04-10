const { exec } = require('child_process');
const db = require('./db');
const { notifyAdmins } = require('./utils');

// Функція для пінгування IP через системну команду
async function pingIP(ip) {
  try {
    // Спочатку перевіряємо чи є IP в базі
    const ipData = await db.getIP(ip);
    if (!ipData) {
      throw new Error(`IP ${ip} не знайдено в списку`);
    }

    // Визначаємо команду в залежності від ОС
    const isWindows = process.platform === 'win32';
    const command = isWindows ?
      `ping -n 2 -w 5000 ${ip}` :
      `ping -c 2 -W 5 ${ip}`;

    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Оновлюємо статус в базі даних як 'down'
          db.updateIPStatus(ip, 'down', null);
          resolve({ alive: false, time: null });
          return;
        }

        // Парсимо час відповіді
        let responseTime = null;
        const output = stdout.toString();

        if (isWindows) {
          // Для Windows
          const match = output.match(/Среднее = (\d+)мс|Average = (\d+)ms/);
          if (match) {
            responseTime = parseInt(match[1] || match[2]);
          }
        } else {
          // Для Linux
          const match = output.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)/);
          if (match) {
            responseTime = parseFloat(match[1]);
          }
        }

        const isAlive = responseTime !== null;
        
        // Оновлюємо статус в базі даних
        db.updateIPStatus(ip, isAlive ? 'up' : 'down', responseTime);
        
        resolve({
          alive: isAlive,
          time: responseTime
        });
      });
    });
    
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