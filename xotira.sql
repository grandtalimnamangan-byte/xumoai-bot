-- ============================================================
--  JARVIS — CHEKSIZ XOTIRA (vektor qidiruv)
--  Supabase SQL Editor da bir marta ishga tushiring
-- ============================================================

-- 1. pgvector kengaytmasini yoqish
create extension if not exists vector;

-- 2. Xotira jadvali
create table if not exists memories (
  id         bigserial primary key,
  chat_id    bigint not null,
  kind       text not null default 'suhbat',
  body       text not null,
  embedding  vector(768),
  created_at timestamptz not null default now()
);

create index if not exists memories_chat_idx on memories (chat_id, created_at desc);

-- 3. Yaqinlik indeksi (yozuvlar ko'paygach tezlashtiradi)
create index if not exists memories_vec_idx
  on memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 4. Qidiruv funksiyasi
create or replace function match_memories(
  p_chat_id   bigint,
  p_query     vector(768),
  p_limit     int default 6,
  p_threshold float default 0.55
)
returns table (
  id         bigint,
  kind       text,
  body       text,
  created_at timestamptz,
  similarity float
)
language sql stable as $$
  select m.id, m.kind, m.body, m.created_at,
         1 - (m.embedding <=> p_query) as similarity
  from memories m
  where m.chat_id = p_chat_id
    and m.embedding is not null
    and 1 - (m.embedding <=> p_query) > p_threshold
  order by m.embedding <=> p_query
  limit p_limit;
$$;
