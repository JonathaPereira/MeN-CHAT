-- Somente leitura. Execute após a migração 20261104000400_managed_invitations.
do $$
begin
 if not exists(select 1 from menchat_private.schema_migrations where version='20261104000400_managed_invitations') then raise exception 'Aplique a migração 4 de convites.'; end if;
 if has_function_privilege('anon','public.menchat_accept_invite(text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.menchat_invite_identity(text)','EXECUTE')
 or has_function_privilege('authenticated','public.menchat_invite_valid(text,text)','EXECUTE')
 or has_schema_privilege('authenticated','menchat_private','USAGE')
 or not has_function_privilege('service_role','public.menchat_invite_identity(text)','EXECUTE')
 or not has_function_privilege('authenticated','public.menchat_accept_invite(text,text)','EXECUTE') then raise exception 'Privilégios de convites divergentes.'; end if;
end $$;
select 'CONVITES_OK' as resultado,
 (select active_profiles from menchat_private.app_state) as contas_ativas,
 (select count(*) from menchat_private.invitations where consumed_at is null and revoked_at is null and expires_at>now()) as convites_validos;
