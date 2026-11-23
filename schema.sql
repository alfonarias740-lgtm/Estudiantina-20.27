-- ESTUDIANTINA 2027 · Ejecutar en Supabase > SQL Editor
create table if not exists config (
  id   int primary key check (id = 1),
  data jsonb not null
);
create table if not exists items (
  id   text primary key,
  kind text not null,            -- pts | acts | news | cal | polls | vote | log
  data jsonb not null default '{}',
  by   text,
  ts   bigint not null
);
create index if not exists items_kind_ts on items (kind, ts);
-- Seguridad: RLS activado SIN políticas = la clave pública no puede leer ni escribir.
-- Solo el servidor (Netlify Function, con la service key) accede.
alter table config enable row level security;
alter table items  enable row level security;
