-- Somente no banco descartável de testes.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('71000000-0000-4000-8000-000000000001','native-a@example.test',now()),
 ('71000000-0000-4000-8000-000000000002','native-b@example.test',now());
insert into public.menchat_profiles(id,display_name,account_status) select id,'Nativo','active' from auth.users where id::text like '71000000%';
insert into public.menchat_threads(id,first_user,second_user) values('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"73000000-0000-4000-8000-000000000002"}',true);
set local role authenticated;
select public.menchat_register_native_push('74000000-0000-4000-8000-000000000002','native-token-fixture-b-1234567890',true,'{}');
do $$ begin
 begin perform 1 from menchat_private.native_devices;raise exception 'Tabela privada acessível';exception when insufficient_privilege then null;end;
 begin perform public.menchat_claim_native_push();raise exception 'Membro leu fila';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select public.menchat_send_composed('75000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','CONTEUDO_PRIVADO_TESTE');
reset role;
do $$ declare jobs jsonb; item jsonb;begin
 jobs:=public.menchat_claim_native_push('71000000-0000-4000-8000-000000000001');
 if jsonb_array_length(jobs)<>1 or jobs::text like '%CONTEUDO_PRIVADO%' then raise exception 'Fila inválida ou conteúdo vazado';end if;
 item:=jobs->0;
 if item->>'recipient'<>'71000000-0000-4000-8000-000000000002' then raise exception 'Destinatário incorreto';end if;
 perform public.menchat_finish_native_push((item->>'id')::uuid,(item->>'device')::uuid,gen_random_uuid(),'sent');
 if exists(select 1 from menchat_private.native_queue where finished) then raise exception 'Lease obsoleto aceito';end if;
 if jsonb_array_length(public.menchat_claim_native_push())<>0 then raise exception 'Lease não exclusivo';end if;
 perform public.menchat_finish_native_push((item->>'id')::uuid,(item->>'device')::uuid,(item->>'lease')::uuid,'sent');
 if not exists(select 1 from menchat_private.native_queue where finished) then raise exception 'Conclusão não registrada';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
select public.menchat_remove_native_push('74000000-0000-4000-8000-000000000002');
do $$begin
 begin perform public.menchat_register_native_push('74000000-0000-4000-8000-000000000002','native-token-fixture-b-1234567890',true,'{}');raise exception 'Sessão revogada ressuscitou';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"session_id":"73000000-0000-4000-8000-000000000003"}',true);
select public.menchat_register_native_push('74000000-0000-4000-8000-000000000002','native-token-fixture-b-1234567890',true,array['72000000-0000-4000-8000-000000000001']::uuid[]);
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select public.menchat_send_composed('75000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001','Silenciada');
select public.menchat_reserve_sticker('72000000-0000-4000-8000-000000000001','figurinha.webp',100000);
do $$begin
 begin perform public.menchat_reserve_sticker('72000000-0000-4000-8000-000000000001','grande.webp',100001);raise exception 'Figurinha acima do limite';exception when check_violation then null;end;
end $$;
reset role;
do $$begin
 if jsonb_array_length(public.menchat_claim_native_push())<>0 then raise exception 'Conversa silenciada gerou push';end if;
 if not exists(select 1 from public.menchat_uploads where is_sticker and mime='image/webp' and bytes=100000) then raise exception 'Reserva de figurinha ausente';end if;
end $$;
rollback;
