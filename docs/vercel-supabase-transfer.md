# RoWorth Vercel + Supabase Transfer

## What to move to Supabase

Run `sql/roworth_tz_upgrade.sql` in the Supabase SQL editor.

Tables expected by the app:

- `users`
- `offers`
- `messages`
- `orders`
- `purchases`
- `reviews`

## What to set in Vercel

Project env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BOT_USERNAME`

If you later move auth and payments to the server:

- `BOT_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

## What to set for the bot

In `bot/.env`:

- `BOT_TOKEN`
- `APP_URL`
- `NEXT_PUBLIC_BOT_USERNAME`

## Recommended deploy order

1. Apply the SQL upgrade in Supabase.
2. Copy env vars into Vercel.
3. Deploy the web app to Vercel.
4. Update `APP_URL` in `bot/.env`.
5. Set the Telegram bot menu button to the new Vercel URL.

## Important note

The current project still performs some balance and order mutations directly from the client. This is acceptable for closed testing only. Before public release, move payment, worth, and rating updates to trusted server logic.
