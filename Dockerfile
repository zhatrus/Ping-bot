FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Створюємо папку для даних
RUN mkdir -p /app/data

CMD ["npm", "start"]