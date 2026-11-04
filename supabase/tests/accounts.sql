-- Dados fictícios isolados por transação. ON_ERROR_STOP é obrigatório no runner.
begin;
insert into auth.users(id) select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1,22) i;
insert into public.menchat_profiles(id, display_name, account_status, user_code)
values ('00000000-0000-0000-0000-000000000001', 'Ana', 'active', 'FORCED'),
       ('00000000-0000-0000-0000-000000000002', 'Lucas', 'active', 'FORCED'),
       ('00000000-0000-0000-0000-000000000003', 'Pendente', 'pending', 'FORCED');
do $$ begin
  if exists (select 1 from public.menchat_profiles where user_code = 'FORCED' or user_code !~ '[0-9]' or user_code !~ '^[A-Z0-9]{6}$') then
    raise exception 'Código não foi gerado/validado.';
  end if;
  if (select active_profiles from menchat_private.app_state) <> 2 then raise exception 'Contador incorreto.'; end if;
end $$;

set local role anon;
do $$ begin
  begin perform * from public.menchat_profiles; raise exception 'Anon leu perfis.';
  exception when insufficient_privilege then null; end;
  begin perform * from menchat_private.invitations; raise exception 'Anon leu convites.';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.menchat_profiles) <> 1 then raise exception 'Perfil alheio vazou.'; end if;
  update public.menchat_profiles set status_message = 'Meu status';
  if not found then raise exception 'Não atualizou perfil próprio.'; end if;
  update public.menchat_profiles set status_message = 'INVADIDO' where id = '00000000-0000-0000-0000-000000000002';
  if found then raise exception 'Atualizou perfil alheio.'; end if;
  begin update public.menchat_profiles set app_role = 'admin'; raise exception 'Escalou privilégio.';
  exception when insufficient_privilege then null; end;
  begin update public.menchat_profiles set account_status = 'active'; raise exception 'Alterou estado.';
  exception when insufficient_privilege then null; end;
  begin update public.menchat_profiles set user_code = 'ABC123'; raise exception 'Alterou código.';
  exception when insufficient_privilege then null; end;
  begin insert into public.menchat_profiles(id,display_name) values (auth.uid(),'Ataque'); raise exception 'Criou perfil.';
  exception when insufficient_privilege then null; end;
  begin delete from public.menchat_profiles; raise exception 'Excluiu perfil.';
  exception when insufficient_privilege then null; end;
  begin perform * from menchat_private.app_state; raise exception 'Leu estado interno.';
  exception when insufficient_privilege then null; end;
  begin perform menchat_private.new_user_code(); raise exception 'Executou função interna.';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.menchat_profiles) then raise exception 'Pendente tem acesso.'; end if;
  update public.menchat_profiles set status_message = 'Ataque';
  if found then raise exception 'Pendente alterou perfil.'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.menchat_profiles) then raise exception 'Sem identidade tem acesso.'; end if;
end $$;
reset role;

set local role service_role;
do $$ begin
  begin update menchat_private.app_state set active_profiles = 0; raise exception 'Servidor alterou contador.';
  exception when insufficient_privilege then null; end;
  begin update public.menchat_profiles set user_code = 'ABC123'; raise exception 'Código deixou de ser imutável.';
  exception when check_violation then null; end;
end $$;
insert into public.menchat_profiles(id, display_name, account_status)
select ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid, 'Pessoa', 'active' from generate_series(4,21) i;
do $$ begin
  begin update public.menchat_profiles set account_status = 'active' where id = '00000000-0000-0000-0000-000000000003';
    raise exception 'Excedeu limite.';
  exception when check_violation then null; end;
end $$;
update public.menchat_profiles set account_status = 'disabled' where id = '00000000-0000-0000-0000-000000000002';
update public.menchat_profiles set account_status = 'active' where id = '00000000-0000-0000-0000-000000000003';
insert into menchat_private.invitations(token_hash,email,pending_user_id,invited_by,expires_at)
values (repeat('a',64),'teste@example.com','00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',now() + interval '1 day');
do $$ begin
  begin insert into menchat_private.invitations(token_hash,email,pending_user_id,invited_by,expires_at)
    values ('token-em-texto','teste@example.com','00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',now() + interval '1 day');
    raise exception 'Aceitou token puro.';
  exception when check_violation then null; end;
  begin insert into menchat_private.invitations(token_hash,email,pending_user_id,invited_by,expires_at)
    values (repeat('b',64),'teste@example.com','00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001',now() + interval '1 day');
    raise exception 'Duplicou convite pendente.';
  exception when unique_violation then null; end;
  begin update menchat_private.invitations set accepted_by = '00000000-0000-0000-0000-000000000002', consumed_at = now();
    raise exception 'Consumiu para outra conta.';
  exception when check_violation then null; end;
end $$;
reset role;
do $$ begin
  if (select active_profiles from menchat_private.app_state) <> 20 then raise exception 'Contador incorreto no limite.'; end if;
  delete from public.menchat_profiles where id = '00000000-0000-0000-0000-000000000001';
  if (select active_profiles from menchat_private.app_state) <> 19 then raise exception 'Exclusão não liberou vaga.'; end if;
  delete from auth.users where id = '00000000-0000-0000-0000-000000000003';
  if (select active_profiles from menchat_private.app_state) <> 18 then raise exception 'Exclusão Auth não liberou vaga.'; end if;
end $$;
rollback;
