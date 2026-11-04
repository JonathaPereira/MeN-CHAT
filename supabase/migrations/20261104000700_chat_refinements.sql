-- Respostas, menções e mensagens marcadas. Aplicar após as versões 1–6.
begin;
alter table public.menchat_messages add column reply_to uuid references public.menchat_messages(id),add column mention_ids uuid[] not null default '{}';
create table menchat_private.message_stars(user_id uuid references public.menchat_profiles(id) on delete cascade,message_id uuid references public.menchat_messages(id),primary key(user_id,message_id));
alter table menchat_private.message_stars enable row level security;
revoke all on menchat_private.message_stars from public,anon,authenticated,service_role;
create function public.menchat_star_message(p_id uuid,p_star boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare m public.menchat_messages%rowtype;
begin
 select * into m from public.menchat_messages where id=p_id;
 if not found or not menchat_private.can_read_thread(m.thread_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_star then
  if m.deleted_at is not null or not menchat_private.message_visible(m.id) then raise exception 'Mensagem indisponível.' using errcode='42501'; end if;
  insert into menchat_private.message_stars values(auth.uid(),p_id) on conflict do nothing;
 else delete from menchat_private.message_stars where user_id=auth.uid() and message_id=p_id; end if;
 return coalesce(p_star,false);
end;
$$;
create function public.menchat_starred(p_thread uuid) returns uuid[] language plpgsql stable security definer set search_path='' as $$
begin
 if not menchat_private.can_read_thread(p_thread) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 return coalesce((select array_agg(q.id) from(select m.id from menchat_private.message_stars s join public.menchat_messages m on m.id=s.message_id where s.user_id=auth.uid() and m.thread_id=p_thread and m.deleted_at is null and menchat_private.message_visible(m.id) order by m.seq desc limit 200) q),'{}'::uuid[]);
end;
$$;
create function public.menchat_send_composed(p_id uuid,p_thread uuid,p_body text,p_reply uuid default null,p_mentions uuid[] default '{}',p_upload uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.menchat_messages%rowtype; target uuid; ids uuid[]; kind text;
begin
 select t.kind into kind from public.menchat_threads t where t.id=p_thread for share;
 if not found or not menchat_private.can_send_thread(p_thread) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_id is null or p_body is null or char_length(p_body)>4000 or p_mentions is null or cardinality(p_mentions)>20 then raise exception 'Dados inválidos.' using errcode='23514'; end if;
 ids:=array(select distinct u from unnest(p_mentions) u order by u);
 if p_reply is not null then
  perform 1 from public.menchat_messages r where r.id=p_reply and r.thread_id=p_thread and r.deleted_at is null and menchat_private.message_visible(r.id) for share;
  if not found then raise exception 'A mensagem respondida não está mais disponível.' using errcode='23514'; end if;
 end if;
 foreach target in array ids loop
  if target is null or kind<>'group' or not exists(select 1 from public.menchat_group_members gm join public.menchat_profiles p on p.id=gm.user_id where gm.thread_id=p_thread and gm.user_id=target and gm.active and p.account_status='active') then raise exception 'Menção indisponível.' using errcode='42501'; end if;
 end loop;
 select * into m from public.menchat_messages where id=p_id;
 if found then
  if m.sender_id=auth.uid() and m.thread_id=p_thread and m.body=p_body and m.attachment_id is not distinct from p_upload and m.reply_to is not distinct from p_reply and m.mention_ids=ids and m.deleted_at is null then return to_jsonb(m); end if;
  raise exception 'Envio já utilizado.' using errcode='23514';
 end if;
 if p_upload is not null then
  if not exists(select 1 from public.menchat_uploads u where u.id=p_upload and u.thread_id=p_thread and u.owner_id=auth.uid()) then raise exception 'Anexo indisponível.' using errcode='42501'; end if;
  perform public.menchat_send_upload(p_id,p_upload,p_body);
 else insert into public.menchat_messages(id,thread_id,sender_id,body) values(p_id,p_thread,auth.uid(),p_body); end if;
 update public.menchat_messages set reply_to=p_reply,mention_ids=ids where id=p_id returning * into m;
 return to_jsonb(m);
end;
$$;
revoke all on function public.menchat_star_message(uuid,boolean),public.menchat_starred(uuid),public.menchat_send_composed(uuid,uuid,text,uuid,uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function public.menchat_star_message(uuid,boolean),public.menchat_starred(uuid),public.menchat_send_composed(uuid,uuid,text,uuid,uuid[],uuid) to authenticated;
create or replace function public.menchat_delete_message(p_id uuid,p_everyone boolean) returns void language plpgsql security definer set search_path='' as $$
declare m public.menchat_messages%rowtype;
begin
 select * into m from public.menchat_messages where id=p_id;
 if not found or not menchat_private.can_read_thread(m.thread_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 perform 1 from public.menchat_threads where id=m.thread_id for share;
 if not menchat_private.can_read_thread(m.thread_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_everyone then
  if m.sender_id<>auth.uid() then raise exception 'Somente o autor pode apagar para todos.' using errcode='42501'; end if;
  update public.menchat_messages set body='Mensagem apagada.',attachment_id=null,reply_to=null,mention_ids='{}',deleted_at=coalesce(deleted_at,clock_timestamp()) where id=p_id;
 else
  insert into menchat_private.hidden_messages values(auth.uid(),p_id) on conflict do nothing;
 end if;
end;
$$;
insert into menchat_private.schema_migrations(version) values('20261104000700_chat_refinements');
commit;
