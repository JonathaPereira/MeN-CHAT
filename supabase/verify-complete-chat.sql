-- Somente leitura: executar depois da migração 5.
do $$ begin
 if not exists(select 1 from menchat_private.schema_migrations where version='20261104000500_complete_chat') then raise exception 'Aplique a migração 5.'; end if;
 if (select count(*) from storage.buckets where id in('menchat-media','menchat-avatars') and not public)<>2 then raise exception 'Os dois buckets devem existir e ser privados.'; end if;
 if has_function_privilege('anon','public.menchat_create_group(text,text[])','EXECUTE')
 or has_function_privilege('anon','public.menchat_reserve_upload(uuid,text,text,bigint)','EXECUTE')
 or has_column_privilege('authenticated','public.menchat_profiles','avatar_path','UPDATE')
 or has_column_privilege('authenticated','public.menchat_messages','attachment_id','INSERT')
 or has_table_privilege('authenticated','public.menchat_group_members','INSERT') then raise exception 'Privilégios divergentes.'; end if;
 if not exists(select 1 from pg_trigger where tgname='menchat_guard_message' and tgenabled='O') then raise exception 'Proteção de envio ausente.'; end if;
 if (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname in('menchat_object_insert','menchat_object_read','menchat_object_delete'))<>3 then raise exception 'Políticas de mídia ausentes.'; end if;
end $$;
select 'CHAT_COMPLETO_OK' as resultado;
