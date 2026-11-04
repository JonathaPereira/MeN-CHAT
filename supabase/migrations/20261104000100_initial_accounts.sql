-- MenChat: base de contas. Aplicar UMA vez no projeto de teste, pelo SQL Editor.
-- Não cria usuários Auth, convites utilizáveis ou contas administrativas.
-- Todas as alterações são atômicas; conflitos fazem a transação inteira falhar.
begin;

create schema menchat_private;
revoke all on schema menchat_private from public, anon, authenticated;
grant usage on schema menchat_private to service_role;

create table menchat_private.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
create table menchat_private.app_state (
  singleton boolean primary key default true check (singleton),
  active_profiles integer not null default 0 check (active_profiles between 0 and 20)
);
insert into menchat_private.app_state (singleton) values (true);

create table public.menchat_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  status_message text not null default '' check (char_length(status_message) <= 140),
  avatar_path text check (avatar_path is null or char_length(avatar_path) between 1 and 512),
  user_code text not null unique check (
    user_code ~ '^[A-Z0-9]{6}$' and user_code ~ '[A-Z]' and user_code ~ '[0-9]'
  ),
  account_status text not null default 'pending' check (account_status in ('pending', 'active', 'disabled')),
  app_role text not null default 'member' check (app_role in ('member', 'admin')),
  show_code boolean not null default true,
  allow_code_lookup boolean not null default true,
  read_receipts boolean not null default true,
  show_typing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table menchat_private.invitations (
  id uuid primary key default gen_random_uuid(),
  -- Somente hash SHA-256 em hexadecimal. O token original nunca entra no banco.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254 and strpos(email, '@') > 1),
  pending_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at),
  revoked_at timestamptz check (revoked_at >= created_at),
  consumed_at timestamptz check (consumed_at >= created_at),
  accepted_by uuid references auth.users(id),
  check ((consumed_at is null) = (accepted_by is null)),
  check (consumed_at is null or accepted_by = pending_user_id),
  check (consumed_at is null or consumed_at <= expires_at),
  check (consumed_at is null or revoked_at is null)
);
create unique index menchat_invitation_pending_email on menchat_private.invitations(email)
  where consumed_at is null and revoked_at is null;
create unique index menchat_invitation_pending_user on menchat_private.invitations(pending_user_id)
  where consumed_at is null and revoked_at is null;

create function menchat_private.new_user_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  candidate text;
  i integer;
begin
  loop
    random_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := '';
    for i in 0..5 loop
      candidate := candidate || substr(alphabet, (get_byte(random_bytes, i) % 32) + 1, 1);
    end loop;
    if candidate ~ '[A-Z]' and candidate ~ '[0-9]' then return candidate; end if;
  end loop;
end;
$$;

create function menchat_private.guard_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- Serializa a atribuição de código entre criações concorrentes.
    perform 1 from menchat_private.app_state where singleton for update;
    loop
      new.user_code := menchat_private.new_user_code();
      exit when not exists (select 1 from public.menchat_profiles where user_code = new.user_code);
    end loop;
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.user_code is distinct from old.user_code
       or new.created_at is distinct from old.created_at then
      raise exception 'Identidade, código e criação do perfil são imutáveis.' using errcode = '23514';
    end if;
    new.updated_at := statement_timestamp();
  end if;

  -- Um contador atualizado atomicamente impõe a cota inclusive sob concorrência.
  if tg_op in ('UPDATE', 'DELETE') and old.account_status = 'active' then
    if tg_op = 'DELETE' then
      update menchat_private.app_state set active_profiles = active_profiles - 1 where singleton;
    elsif new.account_status <> 'active' then
      update menchat_private.app_state set active_profiles = active_profiles - 1 where singleton;
    end if;
  end if;
  if tg_op = 'INSERT' then
    if new.account_status = 'active' then
      update menchat_private.app_state set active_profiles = active_profiles + 1
        where singleton and active_profiles < 20;
      if not found then raise exception 'Limite de 20 contas ativas atingido.' using errcode = '23514'; end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.account_status = 'active' and old.account_status <> 'active' then
      update menchat_private.app_state set active_profiles = active_profiles + 1
        where singleton and active_profiles < 20;
      if not found then raise exception 'Limite de 20 contas ativas atingido.' using errcode = '23514'; end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger menchat_profile_guard before insert or update or delete on public.menchat_profiles
  for each row execute function menchat_private.guard_profile();

-- Não herdar os privilégios amplos de projetos Supabase existentes.
revoke all on public.menchat_profiles from public, anon, authenticated, service_role;
revoke all on all tables in schema menchat_private from public, anon, authenticated, service_role;
revoke all on all functions in schema menchat_private from public, anon, authenticated, service_role;

alter table public.menchat_profiles enable row level security;
alter table menchat_private.invitations enable row level security;
alter table menchat_private.app_state enable row level security;
alter table menchat_private.schema_migrations enable row level security;

-- Por enquanto, o cliente só acessa o próprio perfil ativo. Não há diretório público.
grant select on public.menchat_profiles to authenticated;
grant update (display_name, status_message, avatar_path, show_code, allow_code_lookup, read_receipts, show_typing)
  on public.menchat_profiles to authenticated;
create policy menchat_read_own_active_profile on public.menchat_profiles for select to authenticated
  using ((select auth.uid()) = id and account_status = 'active');
create policy menchat_update_own_active_profile on public.menchat_profiles for update to authenticated
  using ((select auth.uid()) = id and account_status = 'active')
  with check ((select auth.uid()) = id and account_status = 'active');

-- Somente o futuro servidor administrativo poderá provisionar contas/convites.
grant select, insert, update, delete on public.menchat_profiles to service_role;
grant select, insert, update, delete on menchat_private.invitations to service_role;
-- Não há acesso direto ao contador nem às funções internas para service_role.

insert into menchat_private.schema_migrations(version) values ('20261104000100_initial_accounts');
commit;
