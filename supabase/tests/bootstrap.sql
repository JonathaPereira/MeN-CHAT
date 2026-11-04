-- Exclusivo do PostgreSQL descartável de teste. NUNCA executar no Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text unique, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to anon, authenticated, service_role;
-- Simula projetos que concedem acesso amplo por padrão: a migração deve revogar.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges grant execute on functions to public;
