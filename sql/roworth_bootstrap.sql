-- RoWorth bootstrap schema for a fresh Supabase project
-- Run this first on an empty database.

create table if not exists public.users (
  id text primary key,
  username text unique,
  tg_username text,
  tg_name text,
  tg_photo text,
  bio text default '',
  stars integer not null default 0,
  robux integer not null default 0,
  rating numeric not null default 0,
  sales integer not null default 0,
  verified boolean not null default false,
  plan text not null default 'FREE',
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id text primary key,
  uid text not null references public.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  kind text not null,
  type text not null,
  price integer not null default 0,
  cur text not null default 'STARS',
  auto boolean not null default false,
  auto_content text,
  banner text,
  boosted integer not null default 0,
  boost_end bigint not null default 0,
  sales integer not null default 0,
  rating numeric not null default 0,
  stock integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  from_uid text not null references public.users(id) on delete cascade,
  to_uid text not null references public.users(id) on delete cascade,
  text text not null default '',
  img text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  reply_to text,
  reply_text text
);

create table if not exists public.orders (
  id text primary key,
  offer_id text not null references public.offers(id) on delete cascade,
  buyer_uid text not null references public.users(id) on delete cascade,
  seller_uid text not null references public.users(id) on delete cascade,
  offer_snap jsonb not null,
  price integer not null default 0,
  cur text not null default 'STARS',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id text primary key,
  uid text not null references public.users(id) on delete cascade,
  offer_snap jsonb not null,
  price integer not null default 0,
  cur text not null default 'STARS',
  created_at timestamptz not null default now()
);


