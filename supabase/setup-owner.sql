-- OPERACIONAL: somente para o proprietário do projeto, no SQL Editor.
-- Troque SEU_EMAIL_AQUI pelo seu e-mail. Não coloque senha, token ou chave aqui.
-- Antes: provisione a identidade no painel Auth e verifique o e-mail no app.
begin;
do $$
declare
  owner_email text := lower(btrim('SEU_EMAIL_AQUI'));
  owner_id uuid;
begin
  if strpos(owner_email, '@') < 2 then
    raise exception 'Substitua SEU_EMAIL_AQUI pelo e-mail do proprietário.';
  end if;
  if not exists (select 1 from menchat_private.schema_migrations where version = '20261104000200_profile_accounting') then
    raise exception 'Aplique primeiro a migração 20261104000200_profile_accounting.';
  end if;
  -- O bloqueio serializa duas tentativas de configurar administradores diferentes.
  perform 1 from menchat_private.app_state where singleton for update;
  begin
    select id into strict owner_id from auth.users
      where lower(email) = owner_email and email_confirmed_at is not null;
  exception
    when no_data_found then
      raise exception 'Conta não encontrada ou e-mail ainda não verificado. Conclua Primeiro acesso no app.';
    when too_many_rows then
      raise exception 'Mais de uma identidade possui este e-mail. Revise as contas antes de definir o proprietário.';
  end;
  if exists (select 1 from public.menchat_profiles where app_role = 'admin' and id <> owner_id) then
    raise exception 'Já existe outro administrador. Não use este roteiro para promover novas contas.';
  end if;
  insert into public.menchat_profiles(id, display_name, account_status, app_role)
    values (owner_id, 'Administrador', 'active', 'admin')
    on conflict (id) do update set account_status = 'active', app_role = 'admin';
end;
$$;
select 'ADMIN_OK' as resultado, count(*) as administradores_ativos
  from public.menchat_profiles where app_role = 'admin' and account_status = 'active';
commit;
