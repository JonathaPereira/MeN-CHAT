-- Banco descartável; inclui Auth/JWT simulados. Não executar no Supabase.
begin;
create function pg_temp.denied(statement text) returns void language plpgsql as $$
begin
 begin execute statement; exception when insufficient_privilege or check_violation then return; end;
 raise exception 'Operação indevida foi permitida: %', statement;
end;
$$;
insert into auth.users(id,email,email_confirmed_at)
select ('40000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'invite'||i||'@example.test',now() from generate_series(1,21) i;
insert into public.menchat_profiles(id,display_name,account_status,app_role) values('40000000-0000-0000-0000-000000000001','Admin','active','admin');
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.denied($q$select public.menchat_prepare_invite('invite2@example.test')$q$);
select pg_temp.denied($q$select public.menchat_create_invite('invite2@example.test','40000000-0000-0000-0000-000000000002',repeat('0',64))$q$);
select pg_temp.denied('select public.menchat_list_invites()');
select pg_temp.denied($q$select public.menchat_revoke_invite(gen_random_uuid())$q$);
select pg_temp.denied($q$select public.menchat_invite_identity('invite2@example.test')$q$);
select pg_temp.denied($q$select public.menchat_invite_valid(repeat('0',64),'invite2@example.test')$q$);
select pg_temp.denied('select * from menchat_private.invitations');
reset role;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
 if not public.menchat_prepare_invite('invite2@example.test') then raise exception 'Preparo negado'; end if;
end $$;
select public.menchat_create_invite(' INVITE2@example.test ','40000000-0000-0000-0000-000000000002',encode(sha256(convert_to(repeat('A',43),'UTF8')),'hex'));
select pg_temp.denied($q$select public.menchat_create_invite('invite3@example.test','40000000-0000-0000-0000-000000000002',repeat('0',64))$q$);
reset role;
set local role service_role;
do $$ begin
 if not public.menchat_invite_valid(encode(sha256(convert_to(repeat('A',43),'UTF8')),'hex'),'invite2@example.test') then raise exception 'Convite não localizado'; end if;
 if public.menchat_invite_valid(encode(sha256(convert_to(repeat('A',43),'UTF8')),'hex'),'invite3@example.test') then raise exception 'Aceitou outro e-mail'; end if;
end $$;
reset role;
-- Ter senha, um JWT antigo ou o link encaminhado não basta.
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"amr":[{"method":"password","timestamp":9999999999}]}',true);
set local role authenticated;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('A',43),'Novo')$q$);
reset role;
select set_config('request.jwt.claims','{"amr":[{"method":"otp","timestamp":1}]}',true);
set local role authenticated;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('A',43),'Novo')$q$);
reset role;
select set_config('request.jwt.claims',jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',extract(epoch from now())::bigint)))::text,true);
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('A',43),'Outro')$q$);
reset role;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('A',43),null)$q$);
select public.menchat_accept_invite(repeat('A',43),'Novo membro');
do $$ begin
 if not exists(select 1 from public.menchat_profiles where id=auth.uid() and app_role='member' and account_status='active' and user_code ~ '^[A-Z0-9]{6}$') then raise exception 'Perfil não ativado como membro'; end if;
end $$;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('A',43),'Repetido')$q$);
select pg_temp.denied('select public.menchat_list_invites()');
reset role;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.menchat_create_invite('invite3@example.test','40000000-0000-0000-0000-000000000003',encode(sha256(convert_to(repeat('B',43),'UTF8')),'hex'));
select public.menchat_create_invite('invite3@example.test','40000000-0000-0000-0000-000000000003',encode(sha256(convert_to(repeat('C',43),'UTF8')),'hex'));
do $$ begin
 if not exists(select 1 from public.menchat_list_invites() where email='invite2@example.test' and state='used') then raise exception 'Estado usado ausente'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('B',43),'Revogado')$q$);
reset role;
update menchat_private.invitations set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where email='invite3@example.test' and revoked_at is null;
set local role authenticated;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('C',43),'Expirado')$q$);
reset role;
-- Convite para conta desativada não reativa o acesso.
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.menchat_create_invite('invite3@example.test','40000000-0000-0000-0000-000000000003',encode(sha256(convert_to(repeat('D',43),'UTF8')),'hex'));
reset role;
insert into public.menchat_profiles(id,display_name,account_status) values('40000000-0000-0000-0000-000000000003','Desativado','disabled');
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000003',true);
set local role authenticated;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('D',43),'Indevido')$q$);
reset role;
-- Preencher as reservas não ativa contas; reemissão não ocupa outra vaga.
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.menchat_revoke_invite(id) from public.menchat_list_invites() where state='pending';
reset role;
do $$ declare capacity integer; begin
 select active_profiles into capacity from menchat_private.app_state;
 perform set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
 for i in 4..(23-capacity) loop
   perform public.menchat_create_invite('invite'||i||'@example.test',('40000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,encode(sha256(convert_to('token-'||i,'UTF8')),'hex'));
 end loop;
 if (select active_profiles from menchat_private.app_state)<>capacity then raise exception 'Convite ativou conta antes do OTP'; end if;
end $$;
set local role authenticated;
select pg_temp.denied($q$select public.menchat_create_invite('invite21@example.test','40000000-0000-0000-0000-000000000021',repeat('9',64))$q$);
select public.menchat_create_invite('invite4@example.test','40000000-0000-0000-0000-000000000004',encode(sha256(convert_to(repeat('E',43),'UTF8')),'hex'));
reset role;
-- Mesmo o administrador precisa respeitar o orçamento de provisionamento.
set local role authenticated;
do $$ begin
 for i in 1..30 loop perform public.menchat_prepare_invite('invite4@example.test'); end loop;
 if public.menchat_prepare_invite('invite4@example.test') then raise exception 'Limite de tentativas ignorado'; end if;
end $$;
reset role;
-- Ativação externa pode ocupar vagas reservadas: aceite deve reverter inteiro.
insert into public.menchat_profiles(id,display_name,account_status)
select id,'Ativado externamente','active' from auth.users where id::text like '40000000%' and right(id::text,12)::integer between 5 and 21;
insert into public.menchat_profiles(id,display_name,account_status,app_role) values('40000000-0000-0000-0000-000000000004','Pendente','pending','admin');
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('E',43),'Sem vaga')$q$);
reset role;
do $$ begin
 if exists(select 1 from public.menchat_profiles where id='40000000-0000-0000-0000-000000000004' and account_status='active') or exists(select 1 from menchat_private.invitations where pending_user_id='40000000-0000-0000-0000-000000000004' and consumed_at is not null) then raise exception 'Aceite sem vaga alterou dados'; end if;
end $$;
update public.menchat_profiles set account_status='disabled' where id='40000000-0000-0000-0000-000000000021';
set local role authenticated;
select public.menchat_accept_invite(repeat('E',43),'Membro sem promoção');
do $$ begin if not exists(select 1 from public.menchat_profiles where id=auth.uid() and account_status='active' and app_role='member') then raise exception 'Aceite promoveu papel pendente'; end if; end $$;
reset role;
set local role anon;
select pg_temp.denied('select public.menchat_list_invites()');
select pg_temp.denied($q$select public.menchat_accept_invite(repeat('A',43),'Anônimo')$q$);
select pg_temp.denied($q$select public.menchat_invite_identity('invite2@example.test')$q$);
reset role;
rollback;
