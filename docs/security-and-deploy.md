# RoWorth Security And Deploy Notes

## Critical fixes already applied

- Removed the hardcoded Telegram bot token from `bot/bot.js`.
- Added `.env.example` files for the web app and the bot.
- Bot startup now fails fast if `BOT_TOKEN` is missing, instead of silently using an unsafe fallback.
- Production build now runs with TypeScript checks enabled.

## Remaining security risks to address

### 1. Client-side money and order mutations

The current app updates balances, orders, purchases, and sales directly from the browser.

Examples:

- `app/page.tsx` updates `users` during purchase flow
- `app/page.tsx` inserts into `orders`
- `app/page.tsx` inserts into `purchases`
- `app/page.tsx` updates `offers.sales`
- `app/page.tsx` writes chat messages directly

This is acceptable only for a private prototype with very strict Supabase Row Level Security. For a public beta, these writes should move to trusted server routes or Supabase RPC functions using a service role on the server only.

### 2. Telegram identity trust is still mostly client-driven

The app currently reads Telegram user data in the browser and uses it to find or create the local profile. For production, Telegram init data should be verified on the server with the bot token before any privileged action.

### 3. Production build must stay type-safe

Keep `next.config.ts` free of `ignoreBuildErrors`, otherwise Vercel can hide real regressions.

### 4. Encoding and content hygiene

Keep source files in UTF-8 and avoid reintroducing broken text encoding in the UI.

## Recommended hosting path

### Best free setup for testing

- Web app: Vercel Hobby
- Database and realtime: Supabase Free
- Bot: Render or another always-on Node host if you need polling

### Good paid upgrade path later

- Web app: Vercel Pro
- Database: Supabase Pro
- Bot: Railway, Render paid, or a small VPS

## Before first public release

- Move purchase and payout logic off the client
- Verify Telegram auth server-side
- Lock down Supabase policies
- Rotate the bot token if it was ever committed or shared
- Keep TypeScript checks enabled in production builds
