// db.js
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

// Перевірка та створення папки data
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Шляхи до файлів бази даних
const ipsFile = path.join(dataDir, 'ips.json');
const errorsFile = path.join(dataDir, 'errors.json');

// Перевірка і створення файлів
if (!fs.existsSync(ipsFile)) fs.writeFileSync(ipsFile, '[]');
if (!fs.existsSync(errorsFile)) fs.writeFileSync(errorsFile, '[]');

// Створення адаптерів та баз даних
const ipsAdapter = new FileSync(ipsFile);
const errorsAdapter = new FileSync(errorsFile);

const ipsDB = low(ipsAdapter);
const errorsDB = low(errorsAdapter);

// Задаємо стандартні значення
ipsDB.defaults([]).write();
errorsDB.defaults([]).write();

// Функція ініціалізації бази даних
function initDB() {
  console.log('База даних ініціалізована');
  return Promise.resolve();
}

// Отримати всі IP
function getAllIPs() {
  return ipsDB.value();
}

// Отримати IP за адресою
function getIP(ip) {
  return ipsDB.find({ ip }).value();
}

// Додати новий IP
function addIP(ip, name = null) {
  // Перевіряємо чи існує такий IP
  const exists = ipsDB.find({ ip }).value();
  if (exists) {
    return {
      success: false,
      message: `IP ${ip} вже існує в списку`
    };
  }
  
  // Додаємо новий IP
  const now = new Date().toISOString();
  const newIP = {
    ip,
    name: name || null,
    status: 'unknown',
    date_start: now,
    date_last: now,
    date_stop: null,
    responseTime: null
  };
  
  ipsDB.push(newIP).write();
  return { success: true, data: newIP };
}

// Видалити IP
function removeIP(ip) {
  const removed = ipsDB.remove({ ip }).write();
  return removed.length > 0;
}

// Оновити статус IP
function updateIPStatus(ip, status, responseTime = null) {
  const ipToUpdate = ipsDB.find({ ip });
  if (!ipToUpdate.value()) {
    return {
      success: false,
      message: `IP ${ip} не знайдено в списку`
    };
  }
  
  const now = new Date().toISOString();
  const wasDown = ipToUpdate.value().status === 'down';
  
  // Оновлюємо дані
  const updates = {
    status,
    responseTime,
    date_last: now
  };
  
  if (status === 'down' && !wasDown) {
    updates.date_stop = now;
  } else if (status === 'up' && wasDown) {
    const downtime = ipToUpdate.value().date_stop ? 
      new Date(now) - new Date(ipToUpdate.value().date_stop) : 0;
    updates.date_stop = null;
    ipToUpdate.assign(updates).write();
    return {
      success: true,
      downtime
    };
  }
  
  ipToUpdate.assign(updates).write();
  return { success: true };
}

// Оновити назву IP
function updateIPName(ip, newName) {
  const ipToUpdate = ipsDB.find({ ip });
  if (!ipToUpdate.value()) {
    return {
      success: false,
      message: `IP ${ip} не знайдено в списку`
    };
  }
  
  ipToUpdate.assign({ name: newName }).write();
  return { success: true };
}

// Додати помилку до журналу
function addError(ip) {
  const exists = errorsDB.find({ ip }).value();
  if (exists) {
    return false;
  }
  
  errorsDB.push({
    ip,
    date: new Date().toISOString()
  }).write();
  
  return true;
}

// Видалити помилку з журналу
function removeError(ip) {
  const removed = errorsDB.remove({ ip }).write();
  return removed.length > 0;
}

// Отримати всі помилки
function getAllErrors() {
  return errorsDB.value();
}

module.exports = {
  initDB,
  getAllIPs,
  getIP,
  addIP,
  removeIP,
  updateIPStatus,
  updateIPName,
  addError,
  removeError,
  getAllErrors
};