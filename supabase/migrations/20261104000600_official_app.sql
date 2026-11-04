begin;
alter table public.menchat_messages add column deleted_at timestamptz;
create table menchat_private.hidden_messages(user_id uuid references public.menchat_profiles(id) on delete cascade,message_id uuid references public.menchat_messages(id),primary key(user_id,message_id));
create table menchat_private.seen_threads(user_id uuid references public.menchat_profiles(id) on delete cascade,thread_id uuid references public.menchat_threads(id),seq bigint not null default 0,primary key(user_id,thread_id));
insert into menchat_private.seen_threads select user_id,thread_id,read_seq from public.menchat_activity where read_seq>0;
alter table menchat_private.hidden_messages enable row level security;
alter table menchat_private.seen_threads enable row level security;
revoke all on menchat_private.hidden_messages,menchat_private.seen_threads from public,anon,authenticated,service_role;
create function menchat_private.message_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from menchat_private.hidden_messages where user_id=auth.uid() and message_id=p_id);
$$;
revoke all on function menchat_private.message_visible(uuid) from public,anon,authenticated,service_role;
grant execute on function menchat_private.message_visible(uuid) to authenticated;
drop policy menchat_message_read on public.menchat_messages;
create policy menchat_message_read on public.menchat_messages for select to authenticated using(menchat_private.can_read_thread(thread_id) and menchat_private.message_visible(id));
create function public.menchat_delete_message(p_id uuid,p_everyone boolean) returns void language plpgsql security definer set search_path='' as $$
declare m public.menchat_messages%rowtype;
begin
 select * into m from public.menchat_messages where id=p_id;
 if not found or not menchat_private.can_read_thread(m.thread_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 perform 1 from public.menchat_threads where id=m.thread_id for share;
 if not menchat_private.can_read_thread(m.thread_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_everyone then
  if m.sender_id<>auth.uid() then raise exception 'Somente o autor pode apagar para todos.' using errcode='42501'; end if;
  update public.menchat_messages set body='Mensagem apagada.',attachment_id=null,deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_id;
 else
  insert into menchat_private.hidden_messages values(auth.uid(),p_id) on conflict do nothing;
 end if;
end;
$$;
create function public.menchat_seen(p_thread uuid,p_seq bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if not menchat_private.can_read_thread(p_thread) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_seq is null or p_seq<0 or p_seq>coalesce((select max(seq) from public.menchat_messages where thread_id=p_thread),0) then raise exception 'Sequência inválida.' using errcode='23514'; end if;
 insert into menchat_private.seen_threads values(auth.uid(),p_thread,p_seq) on conflict(user_id,thread_id) do update set seq=greatest(seen_threads.seq,excluded.seq);
end;
$$;
create function public.menchat_inbox() returns setof jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object('unread_count',(select count(*) from public.menchat_messages m where m.thread_id=c.id and m.sender_id<>auth.uid() and m.deleted_at is null and menchat_private.message_visible(m.id) and m.seq>coalesce((select seq from menchat_private.seen_threads s where s.user_id=auth.uid() and s.thread_id=c.id),0)),
 'last_body',(select case when m.deleted_at is not null then 'Mensagem apagada.' when m.attachment_id is not null then 'Anexo' else m.body end from public.menchat_messages m where m.thread_id=c.id and menchat_private.message_visible(m.id) order by seq desc limit 1))
 from public.menchat_list_chats() c;
$$;
create or replace function menchat_private.can_read_upload(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.menchat_uploads u where u.id=p_id and u.kind<>'avatar' and menchat_private.can_read_thread(u.thread_id) and
 ((u.used_by is null and u.owner_id=auth.uid()) or exists(select 1 from public.menchat_messages m where m.id=u.used_by and m.deleted_at is null and menchat_private.message_visible(m.id))));
$$;
create function public.menchat_welcome() returns table(name text,code text) language sql stable security definer set search_path='' as $$
 select p.display_name,p.user_code from menchat_private.invitations i join public.menchat_profiles p on p.id=i.invited_by join public.menchat_profiles me on me.id=auth.uid()
 where i.accepted_by=auth.uid() and me.account_status='active' and p.account_status='active' and p.show_code and p.allow_code_lookup
 and not exists(select 1 from public.menchat_threads t where t.kind='private' and auth.uid() in(t.first_user,t.second_user) and p.id in(t.first_user,t.second_user)) limit 1;
$$;
revoke all on function public.menchat_delete_message(uuid,boolean),public.menchat_seen(uuid,bigint),public.menchat_inbox(),public.menchat_welcome() from public,anon,authenticated,service_role;
grant execute on function public.menchat_delete_message(uuid,boolean),public.menchat_seen(uuid,bigint),public.menchat_inbox(),public.menchat_welcome() to authenticated;
insert into menchat_private.schema_migrations(version) values('20261104000600_official_app');
commit;
