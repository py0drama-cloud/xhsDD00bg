# RoWorth Bot — Инструкция

## 1. Создай бота в Telegram
1. Открой @BotFather в Telegram
2. Напиши /newbot
3. Придумай имя: RoWorth Market
4. Придумай username: roworth_market_bot (или любой свободный)
5. Скопируй токен вида: 1234567890:AAxxxxxx...

## 2. Настрой Web App в BotFather
1. В @BotFather напиши /mybots
2. Выбери своего бота
3. Bot Settings → Menu Button → Configure menu button
4. Вставь URL: https://roworth.vercel.app
5. Введи текст кнопки: 🚀 Открыть маркет

## 3. Установи и запусти бота
```bash
cd bot
npm install
```

Создай файл .env:
```
BOT_TOKEN=твой_токен_от_botfather
APP_URL=https://roworth.vercel.app
```

Запусти:
```bash
node bot.js
```

## 4. Хостинг бота (чтобы работал 24/7)

### Вариант A — Railway (бесплатно)
1. Зайди на railway.app
2. New Project → Deploy from GitHub
3. Или: New Project → Empty project → Add service → добавь папку bot
4. В переменных окружения добавь BOT_TOKEN и APP_URL

### Вариант B — Render (бесплатно)
1. Зайди на render.com
2. New → Web Service
3. Загрузи код, укажи Start Command: node bot.js
4. Добавь переменные BOT_TOKEN и APP_URL

### Вариант C — локально для теста
```bash
node bot.js
```
Бот будет работать пока открыт терминал.
