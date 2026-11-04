begin;
insert into auth.users(id) select ('93000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,3) i;
insert into public.menchat_profiles(id,display_name,account_status) select id,'Pessoa','active' from auth.users where id::text like '93000000%';
select set_config('test.code',(select user_code from public.menchat_profiles where id='93000000-0000-0000-0000-000000000002'),true);
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select set_config('test.group',public.menchat_create_group('Teste',array[current_setting('test.code')])::text,true);
select set_config('test.other',public.menchat_create_group('Outro',array[]::text[])::text,true);
select public.menchat_send_composed('94000000-0000-0000-0000-000000000001',current_setting('test.group')::uuid,'Original');
select public.menchat_send_composed('94000000-0000-0000-0000-000000000002',current_setting('test.group')::uuid,'Resposta','94000000-0000-0000-0000-000000000001',array['93000000-0000-0000-0000-000000000002']::uuid[]);
select public.menchat_send_composed('94000000-0000-0000-0000-000000000002',current_setting('test.group')::uuid,'Resposta','94000000-0000-0000-0000-000000000001',array['93000000-0000-0000-0000-000000000002']::uuid[]);
do $$ begin
 if (select count(*) from public.menchat_messages where thread_id=current_setting('test.group')::uuid)<>2 then raise exception 'Resposta duplicou'; end if;
 begin perform public.menchat_send_composed(gen_random_uuid(),current_setting('test.other')::uuid,'Vazamento','94000000-0000-0000-0000-000000000001');raise exception 'Citou outra conversa';exception when check_violation then null;end;
 begin perform public.menchat_send_composed(gen_random_uuid(),current_setting('test.group')::uuid,'Menção inválida',null,array['93000000-0000-0000-0000-000000000003']::uuid[]);raise exception 'Mencionou terceiro';exception when insufficient_privilege then null;end;
end $$;
-- Contexto acompanha a mídia publicada e não altera as regras de Storage.
select set_config('test.upload',(select id from public.menchat_reserve_upload(current_setting('test.group')::uuid,'foto.png','image/png',123))::text,true);
insert into storage.objects(bucket_id,name,metadata) select 'menchat-media',path,'{"size":123,"mimetype":"image/png"}'::jsonb from public.menchat_uploads where id=current_setting('test.upload')::uuid;
select public.menchat_send_composed('94000000-0000-0000-0000-000000000003',current_setting('test.group')::uuid,'','94000000-0000-0000-0000-000000000001',array['93000000-0000-0000-0000-000000000002']::uuid[],current_setting('test.upload')::uuid);
select public.menchat_send_composed('94000000-0000-0000-0000-000000000003',current_setting('test.group')::uuid,'','94000000-0000-0000-0000-000000000001',array['93000000-0000-0000-0000-000000000002']::uuid[],current_setting('test.upload')::uuid);
do $$ begin
 if not exists(select 1 from public.menchat_messages where id='94000000-0000-0000-0000-000000000003' and attachment_id=current_setting('test.upload')::uuid and reply_to='94000000-0000-0000-0000-000000000001') then raise exception 'Mídia perdeu contexto';end if;
 begin update public.menchat_messages set reply_to=null where id='94000000-0000-0000-0000-000000000003';raise exception 'Cliente alterou contexto diretamente';exception when insufficient_privilege then null;end;
end $$;
select public.menchat_star_message('94000000-0000-0000-0000-000000000001',true);
do $$ begin if cardinality(public.menchat_starred(current_setting('test.group')::uuid))<>1 then raise exception 'Não marcou';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $$ begin if cardinality(public.menchat_starred(current_setting('test.group')::uuid))<>0 then raise exception 'Vazou marcação';end if;end $$;
select public.menchat_delete_message('94000000-0000-0000-0000-000000000001',false);
do $$ begin
 begin perform public.menchat_send_composed(gen_random_uuid(),current_setting('test.group')::uuid,'Resposta a oculta','94000000-0000-0000-0000-000000000001');raise exception 'Respondeu oculta';exception when check_violation then null;end;
 begin perform public.menchat_star_message('94000000-0000-0000-0000-000000000001',true);raise exception 'Marcou oculta';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
set local role authenticated;
do $$ begin
 begin perform public.menchat_starred(current_setting('test.group')::uuid);raise exception 'Terceiro consultou favoritos';exception when insufficient_privilege then null;end;
 begin perform public.menchat_send_composed(gen_random_uuid(),current_setting('test.group')::uuid,'Terceiro envia');raise exception 'Terceiro enviou';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.menchat_delete_message('94000000-0000-0000-0000-000000000002',true);
do $$ begin if exists(select 1 from public.menchat_messages where id='94000000-0000-0000-0000-000000000002' and (reply_to is not null or cardinality(mention_ids)>0)) then raise exception 'Apagada manteve contexto';end if;end $$;
select public.menchat_delete_message('94000000-0000-0000-0000-000000000001',true);
do $$ begin
 if cardinality(public.menchat_starred(current_setting('test.group')::uuid))<>0 then raise exception 'Marcada expôs apagada';end if;
 begin perform public.menchat_send_composed(gen_random_uuid(),current_setting('test.group')::uuid,'Resposta a apagada','94000000-0000-0000-0000-000000000001');raise exception 'Respondeu apagada';exception when check_violation then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.menchat_starred(current_setting('test.group')::uuid);raise exception 'Anônimo consultou favoritos';exception when insufficient_privilege then null;end;
 begin perform public.menchat_send_composed(gen_random_uuid(),current_setting('test.group')::uuid,'Anônimo envia');raise exception 'Anônimo enviou';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
