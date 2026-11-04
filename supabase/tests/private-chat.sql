begin;
insert into auth.users(id) select ('20000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,3) i;
insert into public.menchat_profiles(id,display_name,account_status,app_role)
select id,'Contato','active',case when id='20000000-0000-0000-0000-000000000003' then 'admin' else 'member' end from auth.users where id::text like '20000000%';
select set_config('test.contact_code',(select user_code from public.menchat_profiles where id='20000000-0000-0000-0000-000000000002'),true);
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select set_config('test.thread_id',public.menchat_open_private(current_setting('test.contact_code'))::text,true);
do $$ begin
 if public.menchat_open_private(current_setting('test.contact_code'))::text<>current_setting('test.thread_id') then raise exception 'Duplicou privado'; end if;
end $$;
insert into public.menchat_messages(id,thread_id,sender_id,body) values('30000000-0000-0000-0000-000000000001',current_setting('test.thread_id')::uuid,auth.uid(),'Olá privado');
do $$ begin
 begin insert into public.menchat_messages(id,thread_id,sender_id,body) values(gen_random_uuid(),current_setting('test.thread_id')::uuid,'20000000-0000-0000-0000-000000000002','Autor falso'); raise exception 'Forjou autor'; exception when insufficient_privilege then null; end;
 begin update public.menchat_messages set body='Alterado'; raise exception 'Editou mensagem'; exception when insufficient_privilege then null; end;
 begin insert into public.menchat_threads(first_user,second_user) values(auth.uid(),'20000000-0000-0000-0000-000000000003'); raise exception 'Criou thread direto'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.menchat_messages) or exists(select 1 from public.menchat_threads) or exists(select 1 from public.menchat_list_private()) then raise exception 'Administrador leu privado alheio'; end if;
 begin insert into public.menchat_messages(id,thread_id,sender_id,body) values(gen_random_uuid(),current_setting('test.thread_id')::uuid,auth.uid(),'Invasão'); raise exception 'Enviou no privado alheio'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $$ begin if (select count(*) from public.menchat_messages)<>1 then raise exception 'Destinatário não leu'; end if; end $$;
reset role;
update public.menchat_profiles set account_status='disabled' where id='20000000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin if exists(select 1 from public.menchat_messages) then raise exception 'Desativado leu mensagens'; end if; end $$;
reset role;
update public.menchat_profiles set account_status='active',allow_code_lookup=false where id='20000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
 if public.menchat_open_private(current_setting('test.contact_code')) is not null then raise exception 'Busca ignorou privacidade'; end if;
 if (select count(*) from public.menchat_messages)<>1 then raise exception 'Perdeu histórico existente'; end if;
end $$;
reset role;
update public.menchat_profiles set allow_code_lookup=true where id='20000000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin
 for i in 1..16 loop perform public.menchat_open_private('ZZ9999'); end loop;
 if public.menchat_open_private(current_setting('test.contact_code')) is not null then raise exception 'Limite ignorado'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.menchat_messages; raise exception 'Anon leu mensagens'; exception when insufficient_privilege then null; end;
 begin perform public.menchat_list_private(); raise exception 'Anon listou'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
