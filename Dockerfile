FROM node:18-alpine

# Встановлюємо необхідні пакети для ping
RUN apk add --no-cache iputils

# Створюємо робочу директорію
WORKDIR /app

# Копіюємо package.json та package-lock.json
COPY package*.json ./

# Встановлюємо залежності
RUN npm ci --only=production

# Копіюємо код проекту
COPY . .

# Створюємо директорію для даних
RUN mkdir -p src/data && chown -R node:node /app

# Перемикаємося на користувача node
USER node

# Запускаємо бота
CMD [ "node", "src/index.js" ]