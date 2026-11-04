-- Somente leitura. Execute no SQL Editor APÓS a migração inicial.
do $$
begin
  if to_regclass('public.menchat_profiles') is null or to_regclass('menchat_private.schema_migrations') is null then
    raise exception 'A migração inicial do MenChat ainda não foi aplicada.';
  end if;
  if not exists (select 1 from menchat_private.schema_migrations where version = '20261104000100_initial_accounts') then
    raise exception 'Versão inicial não encontrada.';
  end if;
  if not exists (select 1 from menchat_private.schema_migrations where version = '20261104000200_profile_accounting') then
    raise exception 'Aplique a migração 20261104000200_profile_accounting para corrigir a contagem.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.menchat_profiles'::regclass) then
    raise exception 'RLS de perfis precisa estar habilitada.';
  end if;
  if has_table_privilege('anon', 'public.menchat_profiles', 'SELECT')
     or has_table_privilege('authenticated', 'public.menchat_profiles', 'INSERT')
     or has_schema_privilege('authenticated', 'menchat_private', 'USAGE')
     or has_table_privilege('service_role', 'menchat_private.app_state', 'UPDATE') then
    raise exception 'Privilégios diferentes dos esperados. Não libere usuários ainda.';
  end if;
end;
$$;
select 'BASE_OK' as resultado,
       '20261104000200_profile_accounting' as versao,
       (select active_profiles from menchat_private.app_state) as contas_ativas;
-- BASE_OK valida esta base, não o login, e-mail, Realtime ou os convites futuros.
