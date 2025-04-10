const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const fs = require('fs');

// Створюємо папку data, якщо її немає
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Шляхи до файлів
const ipsFile = path.join(dataDir, 'ips.json');
const errorsFile = path.join(dataDir, 'errors.json');

// Створюємо файли, якщо вони не існують
if (!fs.existsSync(ipsFile)) fs.writeFileSync(ipsFile, '[]');
if (!fs.existsSync(errorsFile)) fs.writeFileSync(errorsFile, '[]');

// Ініціалізація баз даних
const ipsDb = new Low(new JSONFile(ipsFile));
const errorsDb = new Low(new JSONFile(errorsFile));

// Ініціалізуємо бази даних
async function initDB() {
  await ipsDb.read();
  await errorsDb.read();
  
  if (!ipsDb.data) ipsDb.data = [];
  if (!errorsDb.data) errorsDb.data = [];
  
  await ipsDb.write();
  await errorsDb.write();
}

// Отримати всі IP
async function getAllIPs() {
  await ipsDb.read();
  return ipsDb.data || [];
}

// Додати новий IP
async function addIP(ip, name = null) {
  await ipsDb.read();
  
  const existing = ipsDb.data.find(item => item.ip === ip);
  if (existing) return { success: false, message: 'Ця IP вже існує' };
  
  const newIP = {
    name,
    ip,
    status: 'unknown',
    date_start: new Date().toISOString(),
    date_stop: null,
    date_last: new Date().toISOString(),
    responseTime: null
  };
  
  ipsDb.data.push(newIP);
  await ipsDb.write();
  return { success: true, data: newIP };
}

// Видалити IP
async function removeIP(ip) {
  await ipsDb.read();
  ipsDb.data = ipsDb.data.filter(item => item.ip !== ip);
  await ipsDb.write();
  return true;
}

// Оновити статус IP
async function updateIPStatus(ip, status, responseTime = null) {
  await ipsDb.read();
  const ipToUpdate = ipsDb.data.find(item => item.ip === ip);
  
  if (!ipToUpdate) return false;
  
  ipToUpdate.status = status;
  ipToUpdate.date_last = new Date().toISOString();
  ipToUpdate.responseTime = responseTime;
  
  if (status === 'down' && ipToUpdate.date_stop === null) {
    ipToUpdate.date_stop = new Date().toISOString();
  } else if (status === 'up' && ipToUpdate.date_stop !== null) {
    const downtime = new Date() - new Date(ipToUpdate.date_stop);
    ipToUpdate.date_stop = null;
    await ipsDb.write();
    return { downtime };
  }
  
  await ipsDb.write();
  return true;
}

// Оновити назву IP
async function updateIPName(ip, newName) {
  await ipsDb.read();
  const ipToUpdate = ipsDb.data.find(item => item.ip === ip);
  
  if (!ipToUpdate) return false;
  
  ipToUpdate.name = newName;
  await ipsDb.write();
  return true;
}

// Додати помилку до журналу
async function addError(ip) {
  await errorsDb.read();
  
  const existingError = errorsDb.data.find(item => item.ip === ip);
  if (existingError) return false;
  
  errorsDb.data.push({
    ip,
    timestamp: new Date().toISOString()
  });
  
  await errorsDb.write();
  return true;
}

// Видалити помилку з журналу
async function removeError(ip) {
  await errorsDb.read();
  const initialLength = errorsDb.data.length;
  errorsDb.data = errorsDb.data.filter(item => item.ip !== ip);
  
  if (errorsDb.data.length < initialLength) {
    await errorsDb.write();
    return true;
  }
  return false;
}

// Отримати всі помилки
async function getAllErrors() {
  await errorsDb.read();
  return errorsDb.data || [];
}

// Отримати інформацію про IP
async function getIP(ip) {
  await ipsDb.read();
  return ipsDb.data.find(item => item.ip === ip);
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