-- RoWorth TЗ upgrade for Supabase
-- Run this in Supabase SQL editor before deploying the updated app.

alter table if exists public.users
  add column if not exists avatar_url text,
  add column if not exists avatar_gif_url text,
  add column if not exists name_color text,
  add column if not exists name_font text default 'Syne',
  add column if not exists badge_icon text,
  add column if not exists badge_label text,
  add column if not exists badge_color text,
  add column if not exists badges jsonb default '[]'::jsonb,
  add column if not exists theme_color text,
  add column if not exists theme_color_2 text,
  add column if not exists profile_banner text,
  add column if not exists worth numeric default 0,
  add column if not exists review_count integer default 0,
  add column if not exists marketplace_id bigint,
  add column if not exists is_admin boolean default false,
  add column if not exists market_banned boolean default false,
  add column if not exists ban_reason text;

create sequence if not exists public.marketplace_user_id_seq;

alter table if exists public.users
  alter column marketplace_id set default nextval('public.marketplace_user_id_seq');

update public.users
set marketplace_id = nextval('public.marketplace_user_id_seq')
where marketplace_id is null;

alter table if exists public.users
  alter column bio type text;

alter table if exists public.offers
  add column if not exists images jsonb default '[]'::jsonb,
  add column if not exists cover_index integer default 0,
  add column if not exists theme_color text,
  add column if not exists text_color text,
  add column if not exists text_font text;

alter table if exists public.messages
  add column if not exists file_url text,
  add column if not exists file_name text,
  add column if not exists file_type text;

alter table if exists public.orders
  add column if not exists review_left boolean default false;

create table if not exists public.reviews (
  id text primary key,
  order_id text not null,
  seller_uid text not null references public.users(id) on delete cascade,
  buyer_uid text not null references public.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  text text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists reviews_order_unique_idx on public.reviews(order_id);
create index if not exists reviews_seller_uid_idx on public.reviews(seller_uid);
create index if not exists offers_uid_idx on public.offers(uid);
create index if not exists messages_dialog_idx on public.messages(from_uid, to_uid);
create index if not exists orders_seller_status_idx on public.orders(seller_uid, status);
create unique index if not exists users_marketplace_id_idx on public.users(marketplace_id);
