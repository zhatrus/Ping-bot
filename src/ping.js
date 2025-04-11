const { exec } = require('child_process');
const db = require('./db');
const { notifyAdmins } = require('./utils');

// Функція для форматування часу простою
function formatDowntime(minutes) {
  if (minutes < 60) {
    return `${minutes} хвилин`;
  }
  
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  
  let result = [];
  
  if (days > 0) {
    result.push(`${days} ${days === 1 ? 'день' : 'днів'}`);
  }
  
  if (hours > 0) {
    result.push(`${hours} ${hours === 1 ? 'година' : 'годин'}`);
  }
  
  if (mins > 0 && days === 0) { // показуємо хвилини тільки якщо немає днів
    result.push(`${mins} хвилин`);
  }
  
  return result.join(' ');
}

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
      exec(command, async (error, stdout, stderr) => {
        if (error) {
          // Оновлюємо статус в базі даних як 'down'
          await db.updateIPStatus(ip, 'down', null);
          
          // Перевіряємо чи потрібно відправити сповіщення про відключення
          const added = await db.addError(ip);
          if (added) {
            const ipData = await db.getIP(ip);
            const ipName = ipData && ipData.name ? ` ${ipData.name}` : '';
            const message = `🔴  ${ipName} IP: ${ip} не відповідає!`;
            await notifyAdmins(message, global.bot);
          }
          
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
        const updateResult = await db.updateIPStatus(ip, isAlive ? 'up' : 'down', responseTime);
        
        // Якщо IP знову онлайн, перевіряємо чи була помилка
        if (isAlive) {
          const hadError = await db.removeError(ip);
          if (hadError && updateResult.downtime) {
            const downtimeMinutes = Math.floor(updateResult.downtime / (1000 * 60));
            const ipData = await db.getIP(ip);
            const ipName = ipData && ipData.name ? ` ${ipData.name}` : '';
            const message = `🟢  ${ipName} IP: ${ip} знову онлайн!\n` +
                           `⏱ Час простою: ${formatDowntime(downtimeMinutes)}`;
            await notifyAdmins(message, global.bot);
          }
        }
        
        resolve({
          alive: isAlive,
          time: responseTime
        });
      });
    });
    

    
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