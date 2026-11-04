-- Somente banco descartável. Storage HTTP/Auth/Realtime são contratos simulados.
begin;
create function pg_temp.rejects(statement text) returns void language plpgsql as $$
begin
 begin execute statement; exception when insufficient_privilege or check_violation or unique_violation then return; end;
 raise exception 'Operação indevida permitida: %',statement;
end;
$$;
insert into auth.users(id) select ('60000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,4) i;
insert into public.menchat_profiles(id,display_name,account_status,app_role) select id,'Teste '||right(id::text,1),'active',case when right(id::text,1)='4' then 'admin' else 'member' end from auth.users where id::text like '60000000%';
select set_config('test.code2',(select user_code from public.menchat_profiles where id='60000000-0000-0000-0000-000000000002'),true);
select set_config('test.code3',(select user_code from public.menchat_profiles where id='60000000-0000-0000-0000-000000000003'),true);
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select set_config('test.group',public.menchat_create_group('Grupo real',array[current_setting('test.code2'),current_setting('test.code3')])::text,true);
select set_config('test.solo',public.menchat_create_group('Só eu',array[]::text[])::text,true);
do $$ begin
 if (select count(*) from public.menchat_list_chats())<>2 then raise exception 'Não listou grupos'; end if;
 if (select count(*) from public.menchat_participants(current_setting('test.group')::uuid))<>3 then raise exception 'Participantes incorretos'; end if;
end $$;
select pg_temp.rejects($q$insert into public.menchat_group_members(thread_id,user_id) values(current_setting('test.group')::uuid,'60000000-0000-0000-0000-000000000004')$q$);
select pg_temp.rejects($q$update public.menchat_threads set creator_id='60000000-0000-0000-0000-000000000004'$q$);
select pg_temp.rejects($q$select public.menchat_manage_group(current_setting('test.group')::uuid,'leave')$q$);
select public.menchat_manage_group(current_setting('test.group')::uuid,'promote','60000000-0000-0000-0000-000000000002');
select public.menchat_manage_group(current_setting('test.group')::uuid,'transfer','60000000-0000-0000-0000-000000000002');
reset role;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select pg_temp.rejects($q$select public.menchat_manage_group(current_setting('test.group')::uuid,'remove','60000000-0000-0000-0000-000000000001')$q$);
select pg_temp.rejects($q$select public.menchat_manage_group(current_setting('test.group')::uuid,'demote','60000000-0000-0000-0000-000000000001')$q$);
select public.menchat_manage_group(current_setting('test.group')::uuid,'remove','60000000-0000-0000-0000-000000000003');
reset role;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.rejects($q$select public.menchat_participants(current_setting('test.group')::uuid)$q$);
select pg_temp.rejects($q$insert into public.menchat_messages(id,thread_id,sender_id,body) values(gen_random_uuid(),current_setting('test.group')::uuid,auth.uid(),'Removido não envia')$q$);
reset role;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000004',true);
set local role authenticated;
do $$ begin if exists(select 1 from public.menchat_list_chats()) then raise exception 'Admin do app leu grupo alheio'; end if; end $$;
select pg_temp.rejects($q$select public.menchat_manage_group(current_setting('test.group')::uuid,'rename',null,null,'Invasão')$q$);
reset role;
-- Reserva e objeto privados; não publicar antes de concluir o upload.
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select set_config('test.upload',(select id from public.menchat_reserve_upload(current_setting('test.group')::uuid,'foto.png','image/png',123))::text,true);
select set_config('test.path',(select path from public.menchat_uploads where id=current_setting('test.upload')::uuid),true);
select pg_temp.rejects($q$select public.menchat_send_upload('61000000-0000-0000-0000-000000000001',current_setting('test.upload')::uuid,'Foto')$q$);
select pg_temp.rejects($q$select public.menchat_reserve_upload(current_setting('test.group')::uuid,'imagem.png','image/png',5000001)$q$);
select pg_temp.rejects($q$select public.menchat_reserve_upload(current_setting('test.group')::uuid,'arquivo.svg','image/svg+xml',100)$q$);
select pg_temp.rejects($q$select public.menchat_reserve_upload(current_setting('test.group')::uuid,'arquivo.exe','text/plain',100)$q$);
insert into storage.objects(bucket_id,name,metadata) values('menchat-media',current_setting('test.path'),'{"size":123,"mimetype":"image/png"}');
select pg_temp.rejects($q$insert into storage.objects(bucket_id,name,metadata) values('menchat-media','outra/pasta','{}')$q$);
do $$ begin update storage.objects set metadata='{}'; if exists(select 1 from storage.objects where metadata='{}') then raise exception 'Sobrescreveu objeto'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $$ begin if exists(select 1 from storage.objects) or exists(select 1 from public.menchat_uploads) then raise exception 'Participante leu anexo ainda não enviado'; end if; end $$;
select pg_temp.rejects($q$select public.menchat_send_upload(gen_random_uuid(),current_setting('test.upload')::uuid,'Roubo de anexo')$q$);
reset role;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.menchat_send_upload('61000000-0000-0000-0000-000000000001',current_setting('test.upload')::uuid,'Foto');
select public.menchat_send_upload('61000000-0000-0000-0000-000000000001',current_setting('test.upload')::uuid,'Foto');
select pg_temp.rejects($q$select public.menchat_send_upload(gen_random_uuid(),current_setting('test.upload')::uuid,'Reutilização')$q$);
do $$ begin
 if (select count(*) from public.menchat_messages)<>1 then raise exception 'Repetição duplicou mídia'; end if;
 delete from storage.objects where name=current_setting('test.path');
 if not exists(select 1 from storage.objects where name=current_setting('test.path')) then raise exception 'Apagou mídia publicada'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $$ begin if (select count(*) from storage.objects)<>1 then raise exception 'Destinatário não lê mídia'; end if; end $$;
select set_config('test.seq',(select seq::text from public.menchat_messages limit 1),true);
select public.menchat_touch(current_setting('test.group')::uuid,current_setting('test.seq')::bigint,current_setting('test.seq')::bigint,true);
select pg_temp.rejects($q$select public.menchat_touch(current_setting('test.group')::uuid,999999999,999999999,true)$q$);
select public.menchat_save_profile('Nome atualizado','Meu status',false,false,false,false,null,false);
do $$ begin
 if not exists(select 1 from public.menchat_profiles where id=auth.uid() and display_name='Nome atualizado' and status_message='Meu status' and not show_code) then raise exception 'Perfil não persistiu'; end if;
 if exists(select 1 from public.menchat_participants(current_setting('test.group')::uuid) where id=auth.uid() and (code is not null or read_seq is not null or is_typing)) then raise exception 'Privacidade de indicadores ignorada'; end if;
end $$;
select pg_temp.rejects($q$update public.menchat_profiles set avatar_path='foto-de-outro'$q$);
-- Avatar precisa de reserva, objeto válido e pertence ao dono da conta.
select set_config('test.avatar',(select id from public.menchat_reserve_upload(null,'perfil.webp','image/webp',100))::text,true);
select set_config('test.avatarpath',(select path from public.menchat_uploads where id=current_setting('test.avatar')::uuid),true);
select pg_temp.rejects($q$select public.menchat_save_profile('Nome','Status',true,true,true,true,current_setting('test.avatar')::uuid,false)$q$);
insert into storage.objects(bucket_id,name,metadata) values('menchat-avatars',current_setting('test.avatarpath'),'{"size":100,"mimetype":"image/webp"}');
select public.menchat_save_profile('Nome','Status',true,true,true,true,current_setting('test.avatar')::uuid,false);
select public.menchat_manage_group(current_setting('test.group')::uuid,'transfer','60000000-0000-0000-0000-000000000001');
select public.menchat_manage_group(current_setting('test.group')::uuid,'leave');
do $$ begin if exists(select 1 from public.menchat_messages) or exists(select 1 from storage.objects where bucket_id='menchat-media') then raise exception 'Quem saiu ainda acessa grupo/mídia'; end if; end $$;
reset role;
-- Retorno do criador é permitido; outros nunca podem removê-lo.
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.rejects($q$select public.menchat_save_profile('Nome','Status',true,true,true,true,current_setting('test.avatar')::uuid,false)$q$);
reset role;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000004',true);
set local role authenticated;
do $$ begin if exists(select 1 from storage.objects) then raise exception 'Admin externo leu arquivos'; end if; end $$;
reset role;
-- Limites por tipo, diário e global antes de gravar bytes.
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.rejects($q$select public.menchat_reserve_upload(null,'perfil.webp','image/webp',200001)$q$);
select public.menchat_reserve_upload(current_setting('test.group')::uuid,'video1.mp4','video/mp4',25000000);
select public.menchat_reserve_upload(current_setting('test.group')::uuid,'video2.mp4','video/mp4',25000000);
select public.menchat_reserve_upload(current_setting('test.group')::uuid,'video3.mp4','video/mp4',25000000);
select pg_temp.rejects($q$select public.menchat_reserve_upload(current_setting('test.group')::uuid,'video4.mp4','video/mp4',25000000)$q$);
reset role;
insert into public.menchat_uploads(owner_id,thread_id,kind,name,mime,bytes,path)
select '60000000-0000-0000-0000-000000000004',current_setting('test.group')::uuid,'video','Orçamento','video/mp4',25000000,'budget/'||i from generate_series(1,16) i;
insert into public.menchat_uploads(owner_id,thread_id,kind,name,mime,bytes,path)
select '60000000-0000-0000-0000-000000000004',current_setting('test.group')::uuid,'video','Orçamento final','video/mp4',500000000-(select sum(bytes) from public.menchat_uploads),'budget/final';
set local role authenticated;
select pg_temp.rejects($q$select public.menchat_reserve_upload(current_setting('test.group')::uuid,'pequeno.txt','text/plain',1)$q$);
reset role;
set local role anon;
select pg_temp.rejects('select public.menchat_list_chats()');
select pg_temp.rejects($q$select public.menchat_reserve_upload(null,'perfil.webp','image/webp',100)$q$);
reset role;
rollback;
