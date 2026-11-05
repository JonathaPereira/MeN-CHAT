-- Experiência nativa: figurinhas e fila FCM privada. Aplicar após 1–8.
begin;
alter table public.menchat_uploads add column is_sticker boolean not null default false;
alter table public.menchat_uploads add constraint menchat_sticker_size check(not is_sticker or (kind='image' and mime='image/webp' and bytes<=100000));
create function public.menchat_reserve_sticker(p_thread uuid,p_name text,p_bytes bigint) returns table(id uuid,path text,kind text)
language plpgsql security definer set search_path='' as $$
declare item record;
begin
 if p_thread is null or p_bytes is null or p_bytes not between 1 and 100000 then raise exception 'Figurinha inválida.' using errcode='23514'; end if;
 select * into item from public.menchat_reserve_upload(p_thread,p_name,'image/webp',p_bytes);
 update public.menchat_uploads u set is_sticker=true where u.id=item.id;
 return query select item.id::uuid,item.path::text,item.kind::text;
end;
$$;
create function menchat_private.native_member(p_user uuid,p_thread uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.menchat_profiles p join public.menchat_threads t on t.id=p_thread where p.id=p_user and p.account_status='active' and
 ((t.kind='private' and p.id in(t.first_user,t.second_user)) or (t.kind='group' and exists(select 1 from public.menchat_group_members gm where gm.thread_id=t.id and gm.user_id=p.id and gm.active))));
$$;
create table menchat_private.native_devices(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.menchat_profiles(id) on delete cascade,
 installation uuid not null unique,token text not null unique,session_id text not null,
 enabled boolean not null,muted uuid[] not null default '{}',updated_at timestamptz not null default now()
);
create table menchat_private.native_revocations(user_id uuid references public.menchat_profiles(id) on delete cascade,installation uuid,session_id text,created_at timestamptz not null default now(),primary key(user_id,installation,session_id));
create table menchat_private.native_queue(
 event_id uuid not null,device_id uuid not null references menchat_private.native_devices(id) on delete cascade,
 user_id uuid not null references public.menchat_profiles(id) on delete cascade,sender_id uuid not null references public.menchat_profiles(id) on delete cascade,
 thread_id uuid not null references public.menchat_threads(id),kind text not null check(kind in('message','call')),
 created_at timestamptz not null default now(),attempts integer not null default 0,lease uuid,lease_until timestamptz,finished boolean not null default false,
 primary key(event_id,device_id)
);
alter table menchat_private.native_devices enable row level security;
alter table menchat_private.native_revocations enable row level security;
alter table menchat_private.native_queue enable row level security;
revoke all on menchat_private.native_devices,menchat_private.native_revocations,menchat_private.native_queue from public,anon,authenticated,service_role;
create function public.menchat_register_native_push(p_installation uuid,p_token text,p_enabled boolean,p_muted uuid[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_session text:=auth.jwt()->>'session_id'; device uuid; previous_owner uuid;
begin
 perform 1 from public.menchat_profiles where id=actor and account_status='active' for update;
 if not found or current_session is null or current_session !~ '^[a-fA-F0-9-]{36}$' then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_installation is null or p_token is null or octet_length(p_token) not between 20 and 4096 or p_token !~ '^[A-Za-z0-9:_\.-]+$' or p_enabled is null or p_muted is null or cardinality(p_muted)>256 or array_position(p_muted,null) is not null then raise exception 'Dispositivo inválido.' using errcode='23514'; end if;
 if exists(select 1 from menchat_private.native_revocations where user_id=actor and installation=p_installation and session_id=current_session) then raise exception 'Sessão desvinculada.' using errcode='42501'; end if;
 delete from menchat_private.native_revocations where created_at<now()-interval '7 days';
 delete from menchat_private.native_devices where updated_at<now()-interval '30 days';
 -- Serialize the token/installation association; a verified account never receives another account's queue.
 perform pg_advisory_xact_lock(hashtextextended('menchat-native-register',0));
 select id,user_id into device,previous_owner from menchat_private.native_devices where installation=p_installation for update;
 if (previous_owner is distinct from actor) and (select count(*) from menchat_private.native_devices where user_id=actor)>=5 then raise exception 'Limite de cinco dispositivos Android.' using errcode='23514'; end if;
 delete from menchat_private.native_devices where token=p_token and installation<>p_installation;
 if device is not null and previous_owner<>actor then delete from menchat_private.native_queue where device_id=device; end if;
 insert into menchat_private.native_devices(user_id,installation,token,session_id,enabled,muted) values(actor,p_installation,p_token,current_session,p_enabled,p_muted)
 on conflict(installation) do update set user_id=excluded.user_id,token=excluded.token,session_id=excluded.session_id,enabled=excluded.enabled,muted=excluded.muted,updated_at=now() returning id into device;
 return device;
end;
$$;
create function public.menchat_remove_native_push(p_installation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.jwt()->>'session_id' is null then raise exception 'Acesso negado.' using errcode='42501'; end if;
 insert into menchat_private.native_revocations(user_id,installation,session_id) values(auth.uid(),p_installation,auth.jwt()->>'session_id') on conflict do nothing;
 delete from menchat_private.native_devices where installation=p_installation and user_id=auth.uid();
end;
$$;
create function menchat_private.native_event_valid(p_event uuid,p_kind text,p_user uuid,p_thread uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_kind='message' and menchat_private.native_member(p_user,p_thread) and exists(select 1 from public.menchat_messages m where m.id=p_event and m.thread_id=p_thread and m.deleted_at is null and not exists(select 1 from menchat_private.hidden_messages h where h.user_id=p_user and h.message_id=m.id));
$$;
create function menchat_private.queue_native_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into menchat_private.native_queue(event_id,device_id,user_id,sender_id,thread_id,kind,created_at)
 select new.id,d.id,d.user_id,new.sender_id,new.thread_id,'message',new.created_at from menchat_private.native_devices d
 where d.enabled and d.user_id<>new.sender_id and not(new.thread_id=any(d.muted)) and menchat_private.native_member(d.user_id,new.thread_id);
 return new;
end;
$$;
create trigger menchat_native_message after insert on public.menchat_messages for each row execute function menchat_private.queue_native_message();
create function public.menchat_claim_native_push(p_actor uuid default null,p_event uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare jobs jsonb;
begin
 delete from menchat_private.native_queue where created_at<now()-interval '24 hours';
 with selected as(
 select q.event_id,q.device_id from menchat_private.native_queue q join menchat_private.native_devices d on d.id=q.device_id
 where not q.finished and q.attempts<3 and (q.lease_until is null or q.lease_until<now()) and d.user_id=q.user_id and d.enabled and not(q.thread_id=any(d.muted))
 and d.updated_at>now()-interval '30 days' and (p_actor is null or q.sender_id=p_actor) and (p_event is null or q.event_id=p_event)
 and menchat_private.native_event_valid(q.event_id,q.kind,q.user_id,q.thread_id)
 order by q.created_at limit 100 for update of q skip locked
 ),claimed as(
 update menchat_private.native_queue q set attempts=q.attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '1 minute' from selected x where q.event_id=x.event_id and q.device_id=x.device_id returning q.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',q.event_id,'device',q.device_id,'recipient',q.user_id,'thread',q.thread_id,'kind',q.kind,'stamp',(extract(epoch from q.created_at)*1000)::bigint::text,'lease',q.lease,'token',d.token)),'[]') into jobs from claimed q join menchat_private.native_devices d on d.id=q.device_id;
 return jobs;
end;
$$;
create function public.menchat_finish_native_push(p_event uuid,p_device uuid,p_lease uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from menchat_private.native_queue where event_id=p_event and device_id=p_device and lease=p_lease and not finished) then return; end if;
 if p_result='expired' then delete from menchat_private.native_devices where id=p_device;
 elsif p_result='sent' then update menchat_private.native_queue set finished=true where event_id=p_event and device_id=p_device and lease=p_lease;
 end if;
end;
$$;
revoke all on function public.menchat_reserve_sticker(uuid,text,bigint),menchat_private.native_member(uuid,uuid),public.menchat_register_native_push(uuid,text,boolean,uuid[]),public.menchat_remove_native_push(uuid),menchat_private.native_event_valid(uuid,text,uuid,uuid),menchat_private.queue_native_message(),public.menchat_claim_native_push(uuid,uuid),public.menchat_finish_native_push(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.menchat_reserve_sticker(uuid,text,bigint),public.menchat_register_native_push(uuid,text,boolean,uuid[]),public.menchat_remove_native_push(uuid) to authenticated;
grant execute on function public.menchat_claim_native_push(uuid,uuid),public.menchat_finish_native_push(uuid,uuid,uuid,text) to service_role;
insert into menchat_private.schema_migrations(version) values('20261105000900_native_experience');
commit;
