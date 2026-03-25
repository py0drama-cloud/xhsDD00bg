require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL || "https://roworth.vercel.app";
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID || process.env.NEWS_CHANNEL_USERNAME || "";
const NEWS_CHANNEL_USERNAME = (process.env.NEWS_CHANNEL_USERNAME || "").replace(/^@/, "");

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is required. Add it to bot/.env before starting the bot.");
}

const bot = new Telegraf(BOT_TOKEN);

function buildOpenMarketKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.webApp("Открыть маркет", APP_URL)]]);
}

function buildSubscribeKeyboard() {
  const buttons = [];
  if (NEWS_CHANNEL_USERNAME) {
    buttons.push([Markup.button.url("Подписаться на канал", `https://t.me/${NEWS_CHANNEL_USERNAME}`)]);
  }
  buttons.push([Markup.button.webApp("Открыть маркет", APP_URL)]);
  return Markup.inlineKeyboard(buttons);
}

function isAllowedMemberStatus(status) {
  return ["creator", "administrator", "member"].includes(status);
}

async function ensureSubscribed(ctx) {
  if (!NEWS_CHANNEL_ID || !ctx.from?.id) return true;

  try {
    const member = await ctx.telegram.getChatMember(NEWS_CHANNEL_ID, ctx.from.id);
    if (isAllowedMemberStatus(member.status)) return true;
  } catch (error) {
    console.error("Subscription check failed:", error?.message || error);
  }

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("Сначала подпишись на новостной канал.", { show_alert: true }).catch(() => {});
  }

  await ctx.reply(
    "Для использования бота сначала подпишись на новостной канал, а затем повтори команду.",
    buildSubscribeKeyboard()
  );
  return false;
}

bot.start(async (ctx) => {
  if (!(await ensureSubscribed(ctx))) return;

  const name = ctx.from.first_name || "друг";
  await ctx
    .replyWithPhoto(
      { url: "https://i.imgur.com/placeholder.png" },
      {
        caption:
          `👋 Привет, *${name}*!\n\n` +
          `*RoWorth* — маркетплейс для Roblox.\n\n` +
          `Покупай и продавай скрипты, карты, UI и многое другое за Telegram Stars и Robux.`,
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.webApp("Открыть маркет", APP_URL)],
          [Markup.button.callback("О боте", "about")],
        ]),
      }
    )
    .catch(() => {
      return ctx.reply(`👋 Привет, *${name}*!\n\n*RoWorth* — маркетплейс для Roblox.`, {
        parse_mode: "Markdown",
        ...buildOpenMarketKeyboard(),
      });
    });
});

bot.command("market", async (ctx) => {
  if (!(await ensureSubscribed(ctx))) return;
  await ctx.reply("Открыть маркетплейс RoWorth:", buildOpenMarketKeyboard());
});

bot.action("about", async (ctx) => {
  if (!(await ensureSubscribed(ctx))) return;
  await ctx.answerCbQuery();
  await ctx.reply(
    "📦 *RoWorth Marketplace*\n\n" +
      "• Скрипты, карты, UI и модели для Roblox\n" +
      "• Оплата через Telegram Stars и Robux\n" +
      "• Верифицированные продавцы\n" +
      "• Безопасные сделки\n\n" +
      "Нажми кнопку ниже, чтобы открыть маркет:",
    {
      parse_mode: "Markdown",
      ...buildOpenMarketKeyboard(),
    }
  );
});

bot.on("text", async (ctx) => {
  if (!(await ensureSubscribed(ctx))) return;
  await ctx.reply("Используй /start или кнопку ниже:", buildOpenMarketKeyboard());
});

bot
  .launch()
  .then(() => console.log("RoWorth bot started"))
  .catch((err) => console.error("Bot error:", err));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
