-- ============================================================
--  JARVIS — VAZIFALAR
--  Supabase SQL Editor da bir marta ishga tushiring
-- ============================================================

create table if not exists tasks (
  id          bigserial primary key,
  chat_id     bigint not null,
  title       text not null,
  due_date    date,
  due_time    text,
  project_id  bigint references projects(id) on delete set null,
  priority    int not null default 3,
  done        boolean not null default false,
  done_at     timestamptz,
  source      text default 'matn',
  created_at  timestamptz not null default now()
);

create index if not exists tasks_open_idx on tasks (chat_id, done, due_date);
