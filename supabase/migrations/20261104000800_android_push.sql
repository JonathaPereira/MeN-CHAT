-- Dispositivos e fila privada de notificações. Aplicar após 1–7.
begin;
create table menchat_private.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.menchat_profiles(id) on delete cascade,
 endpoint text not null unique, keys jsonb not null, enabled boolean not null default true,
 muted uuid[] not null default '{}', updated_at timestamptz not null default now()
);
create table menchat_private.push_queue (
 message_id uuid references public.menchat_messages(id), subscription_id uuid references menchat_private.push_subscriptions(id) on delete cascade,
 user_id uuid not null references public.menchat_profiles(id) on delete cascade,
 attempts integer not null default 0, lease_until timestamptz, finished boolean not null default false,
 primary key(message_id,subscription_id)
);
alter table menchat_private.push_subscriptions enable row level security;
alter table menchat_private.push_queue enable row level security;
revoke all on menchat_private.push_subscriptions,menchat_private.push_queue from public,anon,authenticated,service_role;
create function public.menchat_register_push(p_subscription jsonb,p_enabled boolean,p_muted uuid[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_endpoint text:=p_subscription->>'endpoint'; sid uuid; owner uuid;
begin
 perform 1 from public.menchat_profiles where id=auth.uid() and account_status='active' for update;
 if not found then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if v_endpoint is null or octet_length(p_subscription::text)>4096 or length(v_endpoint)>2048 or v_endpoint !~ '^https://(fcm\.googleapis\.com|web\.push\.apple\.com|updates\.push\.services\.mozilla\.com)/' or coalesce(p_subscription->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}$' or coalesce(p_subscription->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{22}$' or p_enabled is null or p_muted is null or cardinality(p_muted)>256 then raise exception 'Dispositivo inválido.' using errcode='23514';end if;
 delete from menchat_private.push_subscriptions s where s.user_id=auth.uid() and not s.enabled and s.endpoint<>v_endpoint;
 select s.id,s.user_id into sid,owner from menchat_private.push_subscriptions s where s.endpoint=v_endpoint for update;
 if owner is distinct from auth.uid() and (select count(*) from menchat_private.push_subscriptions where user_id=auth.uid())>=5 then raise exception 'Limite de cinco dispositivos.' using errcode='23514';end if;
 if sid is not null and owner<>auth.uid() then delete from menchat_private.push_queue where subscription_id=sid;end if;
 insert into menchat_private.push_subscriptions(user_id,endpoint,keys,enabled,muted) values(auth.uid(),v_endpoint,p_subscription->'keys',p_enabled,p_muted)
 on conflict(endpoint) do update set user_id=excluded.user_id,keys=excluded.keys,enabled=excluded.enabled,muted=excluded.muted,updated_at=now() returning id into sid;
 return sid;
end;
$$;
create function menchat_private.queue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into menchat_private.push_queue(message_id,subscription_id,user_id)
 select new.id,s.id,s.user_id from menchat_private.push_subscriptions s join public.menchat_profiles p on p.id=s.user_id join public.menchat_threads t on t.id=new.thread_id
 where s.enabled and p.account_status='active' and s.user_id<>new.sender_id and not(new.thread_id=any(s.muted)) and
 ((t.kind='private' and s.user_id in(t.first_user,t.second_user)) or (t.kind='group' and exists(select 1 from public.menchat_group_members gm where gm.thread_id=t.id and gm.user_id=s.user_id and gm.active)));
 return new;
end;
$$;
create trigger menchat_push_queue after insert on public.menchat_messages for each row execute function menchat_private.queue_push();
create function public.menchat_claim_push(p_actor uuid default null,p_message uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare jobs jsonb;
begin
 -- Notificações vencidas não reaparecem dias depois. Não contém texto/mídia.
 delete from menchat_private.push_queue q using public.menchat_messages m where m.id=q.message_id and (m.created_at<now()-interval '24 hours' or m.deleted_at is not null);
 with selected as (
 select q.message_id,q.subscription_id from menchat_private.push_queue q
 join public.menchat_messages m on m.id=q.message_id join public.menchat_threads t on t.id=m.thread_id
 join menchat_private.push_subscriptions s on s.id=q.subscription_id join public.menchat_profiles p on p.id=q.user_id
 where not q.finished and q.attempts<3 and (q.lease_until is null or q.lease_until<now()) and m.deleted_at is null
 and s.user_id=q.user_id and s.enabled and p.account_status='active' and not(m.thread_id=any(s.muted))
 and (p_actor is null or m.sender_id=p_actor) and (p_message is null or m.id=p_message)
 and ((t.kind='private' and q.user_id in(t.first_user,t.second_user)) or (t.kind='group' and exists(select 1 from public.menchat_group_members gm where gm.thread_id=t.id and gm.user_id=q.user_id and gm.active)))
 order by m.seq limit 50 for update of q skip locked
 ), claimed as (
 update menchat_private.push_queue q set attempts=q.attempts+1,lease_until=now()+interval '1 minute' from selected x where q.message_id=x.message_id and q.subscription_id=x.subscription_id returning q.*
 ) select coalesce(jsonb_agg(jsonb_build_object('message',c.message_id,'subscription',c.subscription_id,'endpoint',s.endpoint,'keys',s.keys)),'[]') into jobs from claimed c join menchat_private.push_subscriptions s on s.id=c.subscription_id;
 return jobs;
end;
$$;
create function public.menchat_finish_push(p_message uuid,p_subscription uuid,p_result text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_result='expired' then delete from menchat_private.push_subscriptions where id=p_subscription;
 elsif p_result='sent' then update menchat_private.push_queue set finished=true where message_id=p_message and subscription_id=p_subscription;
 end if;
end;
$$;
revoke all on function public.menchat_register_push(jsonb,boolean,uuid[]),menchat_private.queue_push(),public.menchat_claim_push(uuid,uuid),public.menchat_finish_push(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.menchat_register_push(jsonb,boolean,uuid[]) to authenticated;
grant execute on function public.menchat_claim_push(uuid,uuid),public.menchat_finish_push(uuid,uuid,text) to service_role;
create function public.menchat_remove_push(p_id uuid) returns void language sql security definer set search_path='' as $$
 delete from menchat_private.push_subscriptions where id=p_id and user_id=auth.uid();
$$;
revoke all on function public.menchat_remove_push(uuid) from public,anon,authenticated,service_role;
grant execute on function public.menchat_remove_push(uuid) to authenticated;
insert into menchat_private.schema_migrations(version) values('20261104000800_android_push');
commit;
