-- Somente no banco descartável de testes.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('71000000-0000-4000-8000-000000000001','native-a@example.test',now()),
 ('71000000-0000-4000-8000-000000000002','native-b@example.test',now());
insert into public.menchat_profiles(id,display_name,account_status) select id,'Nativo','active' from auth.users where id::text like '71000000%';
insert into public.menchat_threads(id,first_user,second_user) values('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.menchat_send_composed('75000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','Prévia privada');
reset role;
do $$ begin
 if public.menchat_native_preview('75000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001')->>'body'<>'Prévia privada' then raise exception 'Prévia ausente';end if;
 if public.menchat_native_preview('75000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000009','72000000-0000-4000-8000-000000000001')<>'{}'::jsonb then raise exception 'Vazou para terceiro';end if;
 if has_function_privilege('authenticated','public.menchat_native_preview(uuid,uuid,uuid)','execute') then raise exception 'RPC administrativa exposta';end if;
end $$;
update public.menchat_messages set deleted_at=now() where id='75000000-0000-4000-8000-000000000001';
do $$begin
 if public.menchat_native_preview('75000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001')<>'{}'::jsonb then raise exception 'Prévia de apagada';end if;
end $$;
rollback;
