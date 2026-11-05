-- Sinalização autenticada WebRTC. A mídia permanece entre os participantes/P2P ou TURN.
begin;
create table menchat_private.calls(
 id uuid primary key,thread_id uuid not null references public.menchat_threads(id) on delete cascade,
 caller_id uuid not null references public.menchat_profiles(id) on delete cascade,video boolean not null,
 state text not null default 'ringing' check(state in('ringing','active','ended')),created_at timestamptz not null default now(),
 ring_until timestamptz not null default now()+interval '45 seconds',expires_at timestamptz not null default now()+interval '2 hours'
);
create table menchat_private.call_members(
 call_id uuid references menchat_private.calls(id) on delete cascade,user_id uuid references public.menchat_profiles(id) on delete cascade,
 state text not null check(state in('invited','joined','declined','left')),device uuid,
 heartbeat timestamptz not null default now(),mic boolean not null default true,video boolean not null default false,
 primary key(call_id,user_id)
);
create table menchat_private.call_signals(
 seq bigint generated always as identity primary key,call_id uuid not null references menchat_private.calls(id) on delete cascade,
 sender_id uuid not null references public.menchat_profiles(id) on delete cascade,sender_device uuid not null,
 recipient_id uuid not null references public.menchat_profiles(id) on delete cascade,recipient_device uuid not null,
 client_id uuid not null,kind text not null check(kind in('offer','answer','ice','restart')),payload jsonb not null,
 created_at timestamptz not null default now(),unique(call_id,sender_device,client_id)
);
create index menchat_call_inbox on menchat_private.call_members(user_id,state,call_id);
create index menchat_call_signal_sender on menchat_private.call_signals(call_id,sender_id,created_at);
create index menchat_call_signal_delivery on menchat_private.call_signals(call_id,recipient_id,recipient_device,seq);
alter table menchat_private.calls enable row level security;
alter table menchat_private.call_members enable row level security;
alter table menchat_private.call_signals enable row level security;
revoke all on menchat_private.calls,menchat_private.call_members,menchat_private.call_signals from public,anon,authenticated,service_role;
create function menchat_private.sweep_calls() returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from menchat_private.app_state where singleton for update;
 update menchat_private.call_members cm set state='left' where cm.state='joined' and (cm.heartbeat<now()-interval '45 seconds' or not exists(select 1 from menchat_private.calls c where c.id=cm.call_id and c.state<>'ended' and menchat_private.native_member(cm.user_id,c.thread_id)));
 update menchat_private.calls c set state='ended' where c.state<>'ended' and
 (c.expires_at<=now() or (c.state='ringing' and (c.ring_until<=now() or not exists(select 1 from menchat_private.call_members m where m.call_id=c.id and m.user_id=c.caller_id and m.state='joined')))
 or (c.state='active' and (select count(*) from menchat_private.call_members m where m.call_id=c.id and m.state='joined')<2));
 delete from menchat_private.call_signals s using menchat_private.calls c where c.id=s.call_id and c.state='ended';
 delete from menchat_private.calls where created_at<now()-interval '24 hours';
end;
$$;
create function menchat_private.call_access(p_call uuid,p_device uuid,p_joined boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select p_device is not null and exists(select 1 from menchat_private.calls c join menchat_private.call_members m on m.call_id=c.id and m.user_id=auth.uid()
 where c.id=p_call and c.state<>'ended' and c.expires_at>now() and menchat_private.native_member(auth.uid(),c.thread_id)
 and ((m.state='joined' and m.device=p_device) or (not p_joined and m.state='invited' and c.ring_until>now())));
$$;
create function public.menchat_start_call(p_id uuid,p_thread uuid,p_device uuid,p_video boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare existing menchat_private.calls%rowtype; actor uuid:=auth.uid();
begin
 perform menchat_private.sweep_calls();
 if p_id is null or p_device is null or p_video is null or not menchat_private.can_send_thread(p_thread) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 select * into existing from menchat_private.calls where id=p_id;
 if found then
  if existing.caller_id=actor and existing.thread_id=p_thread and existing.video=p_video and menchat_private.call_access(p_id,p_device,true) then return p_id; end if;
  raise exception 'Identificador indisponível.' using errcode='23514';
 end if;
 if exists(select 1 from menchat_private.call_members m join menchat_private.calls c on c.id=m.call_id where m.user_id=actor and m.state='joined' and c.state<>'ended') then raise exception 'Você já está em uma chamada.' using errcode='23514'; end if;
 if exists(select 1 from menchat_private.calls where thread_id=p_thread and state<>'ended') then raise exception 'Já existe uma chamada nesta conversa.' using errcode='23514'; end if;
 if (select count(*) from menchat_private.calls where caller_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Aguarde para iniciar outra chamada.' using errcode='23514'; end if;
 if not exists(select 1 from public.menchat_profiles p where p.id<>actor and menchat_private.native_member(p.id,p_thread) and not exists(select 1 from menchat_private.call_members m join menchat_private.calls c on c.id=m.call_id where m.user_id=p.id and m.state='joined' and c.state<>'ended')) then raise exception 'Contato indisponível ou ocupado.' using errcode='23514'; end if;
 insert into menchat_private.calls(id,thread_id,caller_id,video) values(p_id,p_thread,actor,p_video);
 insert into menchat_private.call_members(call_id,user_id,state,device,mic,video)
 select p_id,p.id,case when p.id=actor then 'joined' when exists(select 1 from menchat_private.call_members m join menchat_private.calls c on c.id=m.call_id where m.user_id=p.id and m.state='joined' and c.state<>'ended') then 'declined' else 'invited' end,
 case when p.id=actor then p_device else null end,true,case when p.id=actor then p_video else false end
 from public.menchat_profiles p where menchat_private.native_member(p.id,p_thread);
 insert into menchat_private.native_queue(event_id,device_id,user_id,sender_id,thread_id,kind)
 select p_id,d.id,d.user_id,actor,p_thread,'call' from menchat_private.native_devices d join menchat_private.call_members m on m.call_id=p_id and m.user_id=d.user_id
 where d.enabled and m.state='invited' and not(p_thread=any(d.muted));
 return p_id;
end;
$$;
create function public.menchat_join_call(p_call uuid,p_device uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform menchat_private.sweep_calls();
 if not menchat_private.call_access(p_call,p_device) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if menchat_private.call_access(p_call,p_device,true) then return true; end if;
 if exists(select 1 from menchat_private.call_members m join menchat_private.calls c on c.id=m.call_id where m.user_id=auth.uid() and m.state='joined' and c.state<>'ended' and c.id<>p_call) then raise exception 'Você já está em uma chamada.' using errcode='23514'; end if;
 if (select count(*) from menchat_private.call_members where call_id=p_call and state='joined')>=4 then raise exception 'Chamada cheia (4 pessoas).' using errcode='23514'; end if;
 update menchat_private.call_members set state='joined',device=p_device,heartbeat=now() where call_id=p_call and user_id=auth.uid();
 update menchat_private.calls set state='active' where id=p_call;
 return true;
end;
$$;
create function public.menchat_leave_call(p_call uuid,p_device uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform menchat_private.sweep_calls();
 if not menchat_private.call_access(p_call,p_device) then return; end if;
 update menchat_private.call_members set state=case when state='invited' then 'declined' else 'left' end where call_id=p_call and user_id=auth.uid() and (state='invited' or device=p_device);
 perform menchat_private.sweep_calls();
end;
$$;
create function public.menchat_call_inbox(p_device uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_device is null or not exists(select 1 from public.menchat_profiles where id=auth.uid() and account_status='active') then raise exception 'Acesso negado.' using errcode='42501'; end if;
 perform menchat_private.sweep_calls();
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'thread',c.thread_id,'caller',c.caller_id,'video',c.video,'state',c.state,'mine',m.state,'created',c.created_at) order by c.created_at desc),'[]') into result
 from menchat_private.calls c join menchat_private.call_members m on m.call_id=c.id and m.user_id=auth.uid()
 where c.state<>'ended' and menchat_private.native_member(auth.uid(),c.thread_id) and ((m.state='joined' and m.device=p_device) or (m.state='invited' and c.ring_until>now()));
 return result;
end;
$$;
create function public.menchat_call_state(p_call uuid,p_device uuid,p_mic boolean,p_video boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; conversation uuid;
begin
 perform menchat_private.sweep_calls();
 if not menchat_private.call_access(p_call,p_device) then raise exception 'Chamada encerrada ou acesso negado.' using errcode='42501'; end if;
 if p_mic is null or p_video is null then raise exception 'Dados inválidos.' using errcode='23514'; end if;
 update menchat_private.call_members set heartbeat=now(),mic=p_mic,video=p_video and (select c.video from menchat_private.calls c where c.id=p_call) where call_id=p_call and user_id=auth.uid() and device=p_device and state='joined';
 select c.thread_id into conversation from menchat_private.calls c where c.id=p_call;
 select jsonb_build_object('id',c.id,'thread',c.thread_id,'caller',c.caller_id,'video',c.video,'state',c.state,'created',c.created_at,'members',
 (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name,'avatar',p.avatar_path,'state',m.state,'device',case when m.state='joined' then m.device else null end,'mic',m.mic,'video',m.video) order by m.user_id),'[]') from menchat_private.call_members m join public.menchat_profiles p on p.id=m.user_id where m.call_id=c.id and menchat_private.native_member(m.user_id,conversation))) into result from menchat_private.calls c where c.id=p_call;
 return result;
end;
$$;
create function public.menchat_call_signal(p_call uuid,p_device uuid,p_to uuid,p_to_device uuid,p_id uuid,p_kind text,p_payload jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare prior menchat_private.call_signals%rowtype; valid boolean:=false;
begin
 perform 1 from menchat_private.calls where id=p_call for share;
 if not menchat_private.call_access(p_call,p_device,true) or p_to=auth.uid() or p_id is null or p_to_device is null or not exists(select 1 from menchat_private.call_members m join menchat_private.calls c on c.id=m.call_id where m.call_id=p_call and m.user_id=p_to and m.state='joined' and m.device=p_to_device and menchat_private.native_member(p_to,c.thread_id)) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>70000 then raise exception 'Sinal inválido.' using errcode='23514'; end if;
 if p_kind in('offer','answer') then valid:=jsonb_typeof(p_payload->'sdp')='string' and left(p_payload->>'sdp',3)='v=0' and char_length(p_payload->>'sdp') between 3 and 65536;
 elsif p_kind='ice' then valid:=jsonb_typeof(p_payload->'candidate')='string' and char_length(p_payload->>'candidate') between 1 and 2048 and jsonb_typeof(p_payload->'sdpMLineIndex')='number' and (p_payload->>'sdpMLineIndex')~'^[0-9]{1,2}$' and (p_payload->>'sdpMLineIndex')::integer<=64 and (p_payload->>'sdpMid' is null or char_length(p_payload->>'sdpMid')<=30);
 elsif p_kind='restart' then valid:=p_payload='{}'::jsonb;
 end if;
 if p_kind<>'restart' then valid:=valid and coalesce(p_payload->>'negotiation','')~'^[a-fA-F0-9-]{36}$'; end if;
 if valid is distinct from true then raise exception 'Sinal inválido.' using errcode='23514'; end if;
 select * into prior from menchat_private.call_signals where call_id=p_call and sender_device=p_device and client_id=p_id;
 if found then
  if prior.sender_id=auth.uid() and prior.recipient_id=p_to and prior.recipient_device=p_to_device and prior.kind=p_kind and prior.payload=p_payload then return true; end if;
  raise exception 'Sinal já utilizado.' using errcode='23514';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('menchat-call-signal-budget',0));
 if coalesce((select sum(octet_length(payload::text)) from menchat_private.call_signals where call_id=p_call),0)+octet_length(p_payload::text)>5000000 or coalesce((select sum(octet_length(payload::text)) from menchat_private.call_signals),0)+octet_length(p_payload::text)>25000000 then raise exception 'Limite de sinalização atingido.' using errcode='23514';end if;
 if (select count(*) from menchat_private.call_signals where call_id=p_call and sender_id=auth.uid() and created_at>now()-interval '10 seconds')>=200 or (select count(*) from menchat_private.call_signals where call_id=p_call and sender_id=auth.uid())>=4000 then raise exception 'Muitos sinais.' using errcode='23514'; end if;
 insert into menchat_private.call_signals(call_id,sender_id,sender_device,recipient_id,recipient_device,client_id,kind,payload) values(p_call,auth.uid(),p_device,p_to,p_to_device,p_id,p_kind,p_payload);
 return true;
end;
$$;
create function public.menchat_call_signals(p_call uuid,p_device uuid,p_after bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_after is null or p_after<0 or not menchat_private.call_access(p_call,p_device,true) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.seq),'[]') into result from(select seq,sender_id,sender_device,kind,payload from menchat_private.call_signals where call_id=p_call and recipient_id=auth.uid() and recipient_device=p_device and seq>p_after order by seq limit 100) q;
 return result;
end;
$$;
create or replace function menchat_private.native_event_valid(p_event uuid,p_kind text,p_user uuid,p_thread uuid) returns boolean language sql stable security definer set search_path='' as $$
 select menchat_private.native_member(p_user,p_thread) and
 ((p_kind='message' and exists(select 1 from public.menchat_messages m where m.id=p_event and m.thread_id=p_thread and m.deleted_at is null and not exists(select 1 from menchat_private.hidden_messages h where h.user_id=p_user and h.message_id=m.id)))
 or (p_kind='call' and exists(select 1 from menchat_private.calls c join menchat_private.call_members m on m.call_id=c.id and m.user_id=p_user where c.id=p_event and c.thread_id=p_thread and c.state<>'ended' and c.ring_until>now() and m.state='invited' and exists(select 1 from menchat_private.call_members caller where caller.call_id=c.id and caller.user_id=c.caller_id and caller.state='joined' and caller.heartbeat>now()-interval '45 seconds' and menchat_private.native_member(caller.user_id,c.thread_id)))));
$$;
revoke all on function menchat_private.sweep_calls(),menchat_private.call_access(uuid,uuid,boolean),public.menchat_start_call(uuid,uuid,uuid,boolean),public.menchat_join_call(uuid,uuid),public.menchat_leave_call(uuid,uuid),public.menchat_call_inbox(uuid),public.menchat_call_state(uuid,uuid,boolean,boolean),public.menchat_call_signal(uuid,uuid,uuid,uuid,uuid,text,jsonb),public.menchat_call_signals(uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.menchat_start_call(uuid,uuid,uuid,boolean),public.menchat_join_call(uuid,uuid),public.menchat_leave_call(uuid,uuid),public.menchat_call_inbox(uuid),public.menchat_call_state(uuid,uuid,boolean,boolean),public.menchat_call_signal(uuid,uuid,uuid,uuid,uuid,text,jsonb),public.menchat_call_signals(uuid,uuid,bigint) to authenticated;
insert into menchat_private.schema_migrations(version) values('20261105001000_private_calls');
commit;
