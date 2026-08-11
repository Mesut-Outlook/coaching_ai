-- Supabase ortamının, schema.sql'i yerelde doğrulamak için gereken asgari taklidi.
-- YALNIZ TEST İÇİNDİR — Supabase'e ASLA çalıştırılmaz, orada bunların hepsi hazır gelir.
--
-- Amacı: `scripts/verifySchema.sh` temiz bir postgres:16 konteynerinde schema.sql'i
-- iki kez koşturup sözdizimi + mantık + IDEMPOTENTLİK doğrulaması yapabilsin.
-- Gerçek Supabase değildir: RLS'in kimi neye karşı koruduğunu ölçmez, yalnız dosyanın
-- hatasız ve tekrar tekrar çalıştığını kanıtlar.

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Supabase'de bunlar JWT claim'lerinden okur; testte oturum değişkeninden okuyorlar.
-- ⚠️ Oturum değişkeni set edilmezse auth.uid() NULL döner — Supabase SQL Editor'deki
-- davranışın AYNISI. schema.sql'in migration bağlamında da çalışması bu sayede sınanır.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

grant usage on schema auth, storage, public to anon, authenticated, service_role;
