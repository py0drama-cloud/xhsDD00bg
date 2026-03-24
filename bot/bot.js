require('dotenv').config()

const { Telegraf, Markup } = require('telegraf')

const BOT_TOKEN = process.env.BOT_TOKEN
const APP_URL = process.env.APP_URL || 'https://roworth.vercel.app'

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required. Add it to bot/.env before starting the bot.')
}

const bot = new Telegraf(BOT_TOKEN)

// ── /start ────────────────────────────────────────────────
bot.start(async (ctx) => {
  const name = ctx.from.first_name || 'друг'
  await ctx.replyWithPhoto(
    { url: 'https://i.imgur.com/placeholder.png' }, // можешь заменить на свой баннер
    {
      caption:
        `👋 Привет, *${name}*\\!\n\n` +
        `*RoWorth* — маркетплейс для Roblox\\.\n\n` +
        `Покупай и продавай скрипты, карты, UI и многое другое за Telegram Stars и Robux\\.`,
      parse_mode: 'MarkdownV2',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Открыть маркет', APP_URL)],
        [Markup.button.callback('ℹ️ О боте', 'about')],
      ])
    }
  ).catch(() => {
    // fallback без фото
    ctx.reply(
      `👋 Привет, *${name}*\\!\n\n*RoWorth* — маркетплейс для Roblox\\.`,
      {
        parse_mode: 'MarkdownV2',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 Открыть маркет', APP_URL)],
        ])
      }
    )
  })
})

// ── /market ───────────────────────────────────────────────
bot.command('market', (ctx) => {
  ctx.reply(
    '🛒 Открыть маркетплейс RoWorth:',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Открыть', APP_URL)],
    ])
  )
})

// ── About ─────────────────────────────────────────────────
bot.action('about', (ctx) => {
  ctx.answerCbQuery()
  ctx.reply(
    '📦 *RoWorth Marketplace*\n\n' +
    '• Скрипты, карты, UI, модели для Roblox\n' +
    '• Оплата через Telegram Stars и Robux\n' +
    '• Верифицированные продавцы\n' +
    '• Безопасные сделки\n\n' +
    'Нажми кнопку ниже чтобы открыть маркет:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Открыть маркет', APP_URL)],
      ])
    }
  )
})

// ── Inline keyboard fallback ──────────────────────────────
bot.on('text', (ctx) => {
  ctx.reply(
    'Используй команду /start или кнопку ниже:',
    Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Открыть маркет', APP_URL)],
    ])
  )
})

// ── Launch ────────────────────────────────────────────────
bot.launch()
  .then(() => console.log('✅ RoWorth bot started'))
  .catch(err => console.error('❌ Bot error:', err))

process.once('SIGINT',  () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
