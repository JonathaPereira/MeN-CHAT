-- MenChat: corrigir contagem em INSERT ... ON CONFLICT (upsert).
-- Aplicar UMA vez após 20261104000100_initial_accounts. Não altera identidades/códigos.
begin;
lock table public.menchat_profiles in share row exclusive mode;

create or replace function menchat_private.guard_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
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
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- AFTER só contabiliza linhas efetivamente inseridas, atualizadas ou excluídas.
-- Um INSERT que vira UPDATE por conflito não ganha uma segunda vaga.
create function menchat_private.count_profiles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
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
  return null;
end;
$$;
create trigger menchat_profile_count after insert or update or delete on public.menchat_profiles
  for each row execute function menchat_private.count_profiles();
revoke all on function menchat_private.count_profiles() from public, anon, authenticated, service_role;
-- Corrige eventual divergência anterior sem alterar perfis. A tabela está bloqueada.
update menchat_private.app_state set active_profiles = (
  select count(*) from public.menchat_profiles where account_status = 'active'
) where singleton;
insert into menchat_private.schema_migrations(version) values ('20261104000200_profile_accounting');
commit;
