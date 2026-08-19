-- ============================================================
--  JARVIS — SHAXSIY TRENER VA NUTRITSIOLOG
--  Supabase SQL Editor da bir marta ishga tushiring
-- ============================================================

create table if not exists health_profile (
  chat_id        bigint primary key,
  height_cm      int,
  weight_kg      numeric,
  age            int,
  activity       text default 'ortacha',
  goal           text default 'rekomp',
  kcal_target    int,
  protein_target int,
  water_target   int,
  workout_days   int default 4,
  level          text default 'boshlangich',
  updated_at     timestamptz not null default now()
);

create table if not exists food_log (
  id          bigserial primary key,
  chat_id     bigint not null,
  day         date not null default current_date,
  meal        text,
  description text not null,
  kcal        int,
  protein     int,
  created_at  timestamptz not null default now()
);

create table if not exists water_log (
  chat_id bigint not null,
  day     date not null default current_date,
  glasses int not null default 0,
  primary key (chat_id, day)
);

create table if not exists workout_log (
  id         bigserial primary key,
  chat_id    bigint not null,
  day        date not null default current_date,
  kind       text not null,
  done       boolean not null default true,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists weight_log (
  chat_id bigint not null,
  day     date not null default current_date,
  weight  numeric not null,
  primary key (chat_id, day)
);

create index if not exists food_log_idx on food_log (chat_id, day desc);
create index if not exists workout_log_idx on workout_log (chat_id, day desc);
