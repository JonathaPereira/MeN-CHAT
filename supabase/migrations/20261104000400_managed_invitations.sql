-- Convites pelo aplicativo. Exige as migrações anteriores. Aplicar uma vez.
begin;

create function menchat_private.is_app_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.menchat_profiles where id=auth.uid() and account_status='active' and app_role='admin');
$$;
revoke all on function menchat_private.is_app_admin() from public,anon,authenticated,service_role;

-- Limita provisionamento Auth feito pelo servidor, antes de usar a chave secreta.
create table menchat_private.invite_limits (
 admin_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null,
 attempts integer not null check (attempts between 1 and 30)
);
alter table menchat_private.invite_limits enable row level security;
revoke all on menchat_private.invite_limits from public,anon,authenticated,service_role;
create function public.menchat_prepare_invite(p_email text) returns boolean
language plpgsql security definer set search_path='' as $$
declare allowed integer; capacity integer;
begin
 if not menchat_private.is_app_admin() then raise exception 'Acesso negado.' using errcode='42501'; end if;
 insert into menchat_private.invite_limits(admin_id,window_start,attempts) values(auth.uid(),clock_timestamp(),1)
 on conflict(admin_id) do update set
 attempts=case when menchat_private.invite_limits.window_start<clock_timestamp()-interval '1 hour' then 1 else menchat_private.invite_limits.attempts+1 end,
 window_start=case when menchat_private.invite_limits.window_start<clock_timestamp()-interval '1 hour' then clock_timestamp() else menchat_private.invite_limits.window_start end
 where menchat_private.invite_limits.window_start<clock_timestamp()-interval '1 hour' or menchat_private.invite_limits.attempts<30
 returning attempts into allowed;
 if allowed is null then return false; end if;
 if exists(select 1 from public.menchat_profiles p join auth.users u on u.id=p.id where lower(u.email)=lower(btrim(p_email)) and p.account_status in ('active','disabled')) then return false; end if;
 select active_profiles into capacity from menchat_private.app_state where singleton;
 return capacity+(select count(*) from menchat_private.invitations where consumed_at is null and revoked_at is null and expires_at>now() and email<>lower(btrim(p_email)))<20;
end;
$$;
revoke all on function public.menchat_prepare_invite(text) from public,anon,authenticated,service_role;
grant execute on function public.menchat_prepare_invite(text) to authenticated;

-- Lookup estrito: somente o servidor, após validar o administrador, usa esta operação.
create function public.menchat_invite_identity(p_email text) returns table(id uuid,confirmed boolean)
language sql stable security definer set search_path='' as $$
 select u.id,u.email_confirmed_at is not null from auth.users u where lower(u.email)=lower(btrim(p_email));
$$;
create function public.menchat_invite_valid(p_hash text,p_email text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from menchat_private.invitations i join auth.users u on u.id=i.pending_user_id
 where i.token_hash=p_hash and i.email=lower(btrim(p_email)) and lower(u.email)=i.email
 and i.consumed_at is null and i.revoked_at is null and i.expires_at>now()
 and not exists(select 1 from public.menchat_profiles p where p.id=u.id and p.account_status in ('active','disabled')));
$$;
revoke all on function public.menchat_invite_identity(text),public.menchat_invite_valid(text,text) from public,anon,authenticated,service_role;
grant execute on function public.menchat_invite_identity(text),public.menchat_invite_valid(text,text) to service_role;

create function public.menchat_create_invite(p_email text,p_user uuid,p_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation uuid; target_email text := lower(btrim(p_email)); capacity integer;
begin
 if not menchat_private.is_app_admin() then raise exception 'Somente administradores ativos podem convidar.' using errcode='42501'; end if;
 perform 1 from menchat_private.app_state where singleton for update;
 if not exists(select 1 from auth.users where id=p_user and lower(email)=target_email and email_confirmed_at is not null) then
   raise exception 'Identidade não provisionada para este e-mail.' using errcode='23514'; end if;
 if exists(select 1 from public.menchat_profiles where id=p_user and account_status in ('active','disabled')) then
   raise exception 'A conta já é ativa ou está desativada.' using errcode='23514'; end if;
 -- Reemitir substitui os convites pendentes anteriores daquele e-mail/identidade.
 update menchat_private.invitations set revoked_at=clock_timestamp() where (email=target_email or pending_user_id=p_user) and consumed_at is null and revoked_at is null;
 select active_profiles into capacity from menchat_private.app_state where singleton;
 capacity := capacity+(select count(*) from menchat_private.invitations where consumed_at is null and revoked_at is null and expires_at>now());
 if capacity>=20 then raise exception 'Limite de contas e convites pendentes atingido.' using errcode='23514'; end if;
 insert into menchat_private.invitations(token_hash,email,pending_user_id,invited_by,expires_at)
 values(p_hash,target_email,p_user,auth.uid(),now()+interval '72 hours') returning id into invitation;
 return invitation;
end;
$$;
create function public.menchat_list_invites() returns table(id uuid,email text,expires_at timestamptz,state text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not menchat_private.is_app_admin() then raise exception 'Acesso negado.' using errcode='42501'; end if;
 return query select i.id,i.email,i.expires_at,case when i.consumed_at is not null then 'used' when i.revoked_at is not null then 'revoked' when i.expires_at<=now() then 'expired' else 'pending' end
 from menchat_private.invitations i order by i.created_at desc,i.id limit 100;
end;
$$;
create function public.menchat_revoke_invite(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not menchat_private.is_app_admin() then raise exception 'Acesso negado.' using errcode='42501'; end if;
 perform 1 from menchat_private.app_state where singleton for update;
 update menchat_private.invitations set revoked_at=clock_timestamp() where id=p_id and consumed_at is null and revoked_at is null;
 return found;
end;
$$;

create function public.menchat_accept_invite(p_token text,p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation menchat_private.invitations%rowtype; actor uuid := auth.uid(); current_email text;
begin
 if actor is null or p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' or p_name is null or char_length(btrim(p_name)) not between 2 and 50 then
   raise exception 'Convite indisponível.' using errcode='42501'; end if;
 -- Um JWT obtido por senha antiga ou pelo próprio link não comprova o novo OTP.
 if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
   where a->>'method'='otp' and a->>'timestamp' ~ '^[0-9]+$'
   and (case when a->>'timestamp' ~ '^[0-9]+$' then (a->>'timestamp')::numeric else 0 end) between extract(epoch from now())-600 and extract(epoch from now())+60) then
   raise exception 'Verifique um novo código de e-mail antes de aceitar.' using errcode='42501'; end if;
 perform 1 from menchat_private.app_state where singleton for update;
 select * into invitation from menchat_private.invitations
 where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or invitation.pending_user_id<>actor or invitation.consumed_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now() then
   raise exception 'Convite indisponível.' using errcode='42501'; end if;
 select lower(email) into current_email from auth.users where id=actor and email_confirmed_at is not null;
 if current_email is distinct from invitation.email or exists(select 1 from public.menchat_profiles where id=actor and account_status in ('active','disabled')) then
   raise exception 'Convite indisponível.' using errcode='42501'; end if;
 insert into public.menchat_profiles(id,display_name,account_status,app_role) values(actor,btrim(p_name),'active','member')
 on conflict(id) do update set display_name=excluded.display_name,account_status='active',app_role='member';
 update menchat_private.invitations set consumed_at=clock_timestamp(),accepted_by=actor where id=invitation.id;
 return actor;
end;
$$;
revoke all on function public.menchat_create_invite(text,uuid,text),public.menchat_list_invites(),public.menchat_revoke_invite(uuid),public.menchat_accept_invite(text,text) from public,anon,authenticated,service_role;
grant execute on function public.menchat_create_invite(text,uuid,text),public.menchat_list_invites(),public.menchat_revoke_invite(uuid),public.menchat_accept_invite(text,text) to authenticated;
insert into menchat_private.schema_migrations(version) values('20261104000400_managed_invitations');
commit;
