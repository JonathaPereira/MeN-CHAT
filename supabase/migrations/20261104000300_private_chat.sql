begin;
create table public.menchat_threads (
 id uuid primary key default gen_random_uuid(),
 first_user uuid not null references public.menchat_profiles(id),
 second_user uuid not null references public.menchat_profiles(id),
 created_at timestamptz not null default now(),
 check (first_user < second_user), unique(first_user,second_user)
);
create table public.menchat_messages (
 id uuid primary key,
 seq bigint generated always as identity unique check (seq <= 9007199254740991),
 thread_id uuid not null references public.menchat_threads(id),
 sender_id uuid not null references public.menchat_profiles(id),
 body text not null check (char_length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default clock_timestamp()
);
create index menchat_messages_history on public.menchat_messages(thread_id,seq desc);
create table menchat_private.lookup_limits (
 user_id uuid primary key references public.menchat_profiles(id) on delete cascade,
 window_start timestamptz not null default now(), attempts integer not null default 1
);
alter table public.menchat_threads enable row level security;
alter table public.menchat_messages enable row level security;
alter table menchat_private.lookup_limits enable row level security;
revoke all on public.menchat_threads,public.menchat_messages,menchat_private.lookup_limits from public,anon,authenticated,service_role;
revoke all on sequence public.menchat_messages_seq_seq from public,anon,authenticated,service_role;

create function menchat_private.can_read_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.menchat_threads t join public.menchat_profiles p on p.id=auth.uid()
 where t.id=p_thread and p.account_status='active' and p.id in (t.first_user,t.second_user));
$$;
create function menchat_private.can_send_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select menchat_private.can_read_thread(p_thread) and exists(select 1 from public.menchat_threads t
 join public.menchat_profiles a on a.id=t.first_user join public.menchat_profiles b on b.id=t.second_user
 where t.id=p_thread and a.account_status='active' and b.account_status='active');
$$;
revoke all on function menchat_private.can_read_thread(uuid),menchat_private.can_send_thread(uuid) from public,anon,authenticated,service_role;
grant execute on function menchat_private.can_read_thread(uuid),menchat_private.can_send_thread(uuid) to authenticated;
grant select on public.menchat_threads,public.menchat_messages to authenticated;
grant insert(id,thread_id,sender_id,body) on public.menchat_messages to authenticated;
grant usage on sequence public.menchat_messages_seq_seq to authenticated;
create policy menchat_thread_read on public.menchat_threads for select to authenticated using (menchat_private.can_read_thread(id));
create policy menchat_message_read on public.menchat_messages for select to authenticated using (menchat_private.can_read_thread(thread_id));
create policy menchat_message_send on public.menchat_messages for insert to authenticated
 with check (sender_id=(select auth.uid()) and menchat_private.can_send_thread(thread_id));

create function public.menchat_open_private(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); target uuid; conversation uuid; tries integer;
begin
 if not exists(select 1 from public.menchat_profiles where id=actor and account_status='active') then
   raise exception 'Acesso indisponível.' using errcode='42501'; end if;
 insert into menchat_private.lookup_limits(user_id) values(actor)
 on conflict(user_id) do update set attempts=case when menchat_private.lookup_limits.window_start < now()-interval '60 seconds' then 1 else least(menchat_private.lookup_limits.attempts+1,1000) end,
 window_start=case when menchat_private.lookup_limits.window_start < now()-interval '60 seconds' then now() else menchat_private.lookup_limits.window_start end returning attempts into tries;
 -- Retornar NULL preserva o contador mesmo em buscas sem resultado.
 if tries > 15 or p_code is null or p_code !~* '^[A-Z0-9]{6}$' then return null; end if;
 select id into target from public.menchat_profiles where user_code=upper(p_code) and allow_code_lookup and account_status='active' and id<>actor;
 if target is null then return null; end if;
 insert into public.menchat_threads(first_user,second_user) values(least(actor,target),greatest(actor,target))
 on conflict(first_user,second_user) do update set first_user=excluded.first_user returning id into conversation;
 return conversation;
end;
$$;
create function public.menchat_list_private() returns table(id uuid,name text,can_send boolean)
language sql stable security definer set search_path='' as $$
 select t.id,p.display_name,menchat_private.can_send_thread(t.id) from public.menchat_threads t
 join public.menchat_profiles p on p.id=case when t.first_user=auth.uid() then t.second_user else t.first_user end
 where menchat_private.can_read_thread(t.id) order by t.created_at desc,t.id;
$$;
revoke all on function public.menchat_open_private(text),public.menchat_list_private() from public,anon,authenticated,service_role;
grant execute on function public.menchat_open_private(text),public.menchat_list_private() to authenticated;
-- Postgres Changes aplica SELECT/RLS a cada destinatário. Nenhum canal público de chat.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='menchat_messages') then
   alter publication supabase_realtime add table public.menchat_messages;
  end if;
 end if;
end $$;
insert into menchat_private.schema_migrations(version) values('20261104000300_private_chat');
commit;
