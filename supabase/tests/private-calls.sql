begin;
insert into auth.users(id,email,email_confirmed_at) select ('81000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'call'||i||'@example.test',now() from generate_series(1,6)i;
insert into public.menchat_profiles(id,display_name,account_status) select id,'Chamada','active' from auth.users where id::text like '81000000%';
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select set_config('fixture.codes',(select jsonb_agg(user_code)::text from public.menchat_profiles where id::text like '81000000%' and right(id::text,1) in('2','3','4','5')),true);
set local role authenticated;
select set_config('fixture.group',public.menchat_create_group('Chamada de grupo',array(select jsonb_array_elements_text(current_setting('fixture.codes')::jsonb)))::text,true);
select public.menchat_start_call('82000000-0000-4000-8000-000000000001',current_setting('fixture.group')::uuid,'83000000-0000-4000-8000-000000000001',true);
-- Repetição idempotente do início.
select public.menchat_start_call('82000000-0000-4000-8000-000000000001',current_setting('fixture.group')::uuid,'83000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
select public.menchat_join_call('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002');
do $$begin
 begin perform public.menchat_call_state('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000009',true,true);raise exception 'Outro dispositivo assumiu';exception when insufficient_privilege then null;end;
 begin perform 1 from menchat_private.call_signals;raise exception 'Sinais privados acessíveis';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
select public.menchat_join_call('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000004',true);
select public.menchat_join_call('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000004');
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000005',true);
do $$begin
 begin perform public.menchat_join_call('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000005');raise exception 'Quinta pessoa entrou';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000006',true);
do $$begin
 if jsonb_array_length(public.menchat_call_inbox('83000000-0000-4000-8000-000000000006'))<>0 then raise exception 'Inbox de terceiro';end if;
 begin perform public.menchat_call_signals('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000006');raise exception 'Terceiro leu sinal';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select public.menchat_call_signal('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001','offer','{"sdp":"v=0\r\n","negotiation":"85000000-0000-4000-8000-000000000001"}');
select public.menchat_call_signal('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001','offer','{"sdp":"v=0\r\n","negotiation":"85000000-0000-4000-8000-000000000001"}');
do $$begin
 begin perform public.menchat_call_signal('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001','restart','{}');raise exception 'Id reutilizado com outro conteúdo';exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
do $$begin
 if jsonb_array_length(public.menchat_call_signals('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002'))<>1 then raise exception 'Repetição de sinal não idempotente';end if;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
do $$begin
 if jsonb_array_length(public.menchat_call_signals('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003'))<>0 then raise exception 'Sinal para outro participante vazou';end if;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
do $$ declare accepted integer:=0;begin
 for i in 1..100 loop
  begin
   perform public.menchat_call_signal('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002',gen_random_uuid(),'offer',jsonb_build_object('sdp','v=0'||repeat('a',64000),'negotiation',gen_random_uuid()));accepted:=accepted+1;
  exception when check_violation then exit;end;
 end loop;
 if accepted<50 or accepted>80 then raise exception 'Orçamento de sinalização não limitou bytes: %',accepted;end if;
end $$;
select public.menchat_manage_group(current_setting('fixture.group')::uuid,'remove','81000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
do $$begin
 begin perform public.menchat_call_signals('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002');raise exception 'Removido leu sinais';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
select public.menchat_leave_call('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000004',true);
select public.menchat_leave_call('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000004');
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
do $$begin
 if jsonb_array_length(public.menchat_call_inbox('83000000-0000-4000-8000-000000000001'))<>0 then raise exception 'Chamada vazia não encerrou';end if;
end $$;
rollback;
