const { isUserAllowed } = require('../utils');
const { showIPList } = require('./messages');
const db = require('../db');

// Обробник команди /start
async function handleStart(ctx) {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }
  
  await ctx.reply(
    '👋 Вітаю! Це бот для моніторингу IP-адрес.\n\n' +
    'Доступні команди:\n' +
    '/ip - Список всіх IP\n' +
    '/add - Додати нову IP\n' +
    '/help - Довідка'
  );
  
  ctx.reply('Ось список ваших IP:');
  await showIPList(ctx);
}

// Обробник команди /cancel
async function handleCancel(ctx) {
  const userId = ctx.from.id;
  if (global.userStates.has(userId)) {
    global.userStates.delete(userId);
    await ctx.reply('Команду скасовано.');
  } else {
    await ctx.reply('Немає активної команди для скасування.');
  }
}

// Обробник команди /ip
async function handleIp(ctx) {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }
  await showIPList(ctx);
}

// Обробник команди /add
async function handleAdd(ctx) {
  if (!isUserAllowed(ctx.chat.id)) {
    return ctx.reply('Доступ заборонено!');
  }
  global.userStates.set(ctx.from.id, {
    command: 'add',
    step: 'waiting_ip'
  });
  await ctx.reply('Введіть IP-адресу для моніторингу:');
}

module.exports = {
  handleStart,
  handleCancel,
  handleIp,
  handleAdd
};
