-- MenChat: grupos, mídia privada, perfil e indicadores. Migrações 1–4 obrigatórias.
begin;
do $$ begin
 if not exists(select 1 from menchat_private.schema_migrations where version='20261104000400_managed_invitations') then raise exception 'Aplique primeiro a migração 4 de convites.'; end if;
end $$;
alter table public.menchat_threads
 add column kind text not null default 'private' check(kind in ('private','group')),
 add column group_name text,
 add column creator_id uuid references public.menchat_profiles(id),
 add column owner_id uuid references public.menchat_profiles(id),
 alter column first_user drop not null, alter column second_user drop not null,
 add constraint menchat_thread_kind check (
 (kind='private' and first_user is not null and second_user is not null and group_name is null and creator_id is null and owner_id is null)
 or (kind='group' and first_user is null and second_user is null and group_name is not null and char_length(btrim(group_name)) between 1 and 60 and creator_id is not null and owner_id is not null));
create table public.menchat_group_members (
 thread_id uuid not null references public.menchat_threads(id),
 user_id uuid not null references public.menchat_profiles(id),
 role text not null default 'member' check(role in ('member','admin')),
 active boolean not null default true,
 primary key(thread_id,user_id)
);
alter table public.menchat_group_members enable row level security;
revoke all on public.menchat_group_members from public,anon,authenticated,service_role;

create or replace function menchat_private.can_read_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.menchat_threads t join public.menchat_profiles p on p.id=auth.uid()
 where t.id=p_thread and p.account_status='active' and
 ((t.kind='private' and p.id in(t.first_user,t.second_user)) or
 (t.kind='group' and exists(select 1 from public.menchat_group_members m where m.thread_id=t.id and m.user_id=p.id and m.active))));
$$;
create or replace function menchat_private.can_send_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select menchat_private.can_read_thread(p_thread) and exists(select 1 from public.menchat_threads t where t.id=p_thread and
 (t.kind='group' or exists(select 1 from public.menchat_profiles a join public.menchat_profiles b on b.id=t.second_user where a.id=t.first_user and a.account_status='active' and b.account_status='active')));
$$;
create function menchat_private.find_code(p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare tries integer; target uuid;
begin
 insert into menchat_private.lookup_limits(user_id) values(auth.uid()) on conflict(user_id) do update set
 attempts=case when menchat_private.lookup_limits.window_start<now()-interval '1 minute' then 1 else least(menchat_private.lookup_limits.attempts+1,1000) end,
 window_start=case when menchat_private.lookup_limits.window_start<now()-interval '1 minute' then now() else menchat_private.lookup_limits.window_start end returning attempts into tries;
 if tries>30 then return null; end if;
 select id into target from public.menchat_profiles where account_status='active' and allow_code_lookup and user_code=upper(btrim(p_code));
 return target;
end;
$$;
create function public.menchat_create_group(p_name text,p_codes text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); members uuid[]; target uuid; code text; conversation uuid;
begin
 -- Serializa a cota de grupos criados por pessoa.
 perform 1 from public.menchat_profiles p where p.id=actor and p.account_status='active' for update;
 if not found then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 or p_codes is null or cardinality(p_codes)>19 then raise exception 'Dados inválidos.' using errcode='23514'; end if;
 if (select count(*) from public.menchat_threads where creator_id=actor)>=32 then raise exception 'Limite de grupos atingido.' using errcode='23514'; end if;
 members:=array[actor];
 foreach code in array p_codes loop
  target:=menchat_private.find_code(code);
  if target is null then return null; end if;
  if not target=any(members) then members:=array_append(members,target); end if;
 end loop;
 insert into public.menchat_threads(kind,group_name,creator_id,owner_id) values('group',btrim(p_name),actor,actor) returning id into conversation;
 insert into public.menchat_group_members(thread_id,user_id,role) select conversation,u,case when u=actor then 'admin' else 'member' end from unnest(members) u;
 return conversation;
end;
$$;
create function public.menchat_manage_group(p_thread uuid,p_action text,p_user uuid default null,p_code text default null,p_name text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare t public.menchat_threads%rowtype; actor uuid:=auth.uid(); actor_role text; target_role text; target uuid:=p_user; owner boolean;
begin
 select * into t from public.menchat_threads where id=p_thread and kind='group' for update;
 if not found or not menchat_private.can_read_thread(p_thread) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 select role into actor_role from public.menchat_group_members where thread_id=p_thread and user_id=actor and active;
 owner:=t.owner_id=actor;
 if p_action='leave' then
  if owner and (select count(*) from public.menchat_group_members where thread_id=p_thread and active)>1 then raise exception 'Transfira a propriedade antes de sair.' using errcode='23514'; end if;
  update public.menchat_group_members set active=false where thread_id=p_thread and user_id=actor;
  return true;
 end if;
 if actor_role<>'admin' then raise exception 'Somente administradores.' using errcode='42501'; end if;
 if p_action='rename' then
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'Nome inválido.' using errcode='23514'; end if;
  update public.menchat_threads set group_name=btrim(p_name) where id=p_thread; return true;
 elsif p_action='add' then
  target:=menchat_private.find_code(p_code);
  if target is null then return false; end if;
  if exists(select 1 from public.menchat_group_members where thread_id=p_thread and user_id=target and active) then return false; end if;
  if (select count(*) from public.menchat_group_members where thread_id=p_thread and active)>=20 then raise exception 'Grupo cheio.' using errcode='23514'; end if;
  insert into public.menchat_group_members(thread_id,user_id,role) values(p_thread,target,case when target=t.creator_id then 'admin' else 'member' end)
  on conflict(thread_id,user_id) do update set active=true,role=excluded.role; return true;
 end if;
 select role into target_role from public.menchat_group_members where thread_id=p_thread and user_id=target and active;
 if target_role is null or target=actor then raise exception 'Participante inválido.' using errcode='23514'; end if;
 if p_action='transfer' and owner then
  if not exists(select 1 from public.menchat_profiles where id=target and account_status='active') then raise exception 'Conta indisponível.' using errcode='23514'; end if;
  update public.menchat_group_members set role='admin' where thread_id=p_thread and user_id=target;
  update public.menchat_threads set owner_id=target where id=p_thread; return true;
 end if;
 if target=t.creator_id or target=t.owner_id then raise exception 'Criador e proprietário são protegidos.' using errcode='42501'; end if;
 if p_action='promote' then update public.menchat_group_members set role='admin' where thread_id=p_thread and user_id=target; return true; end if;
 if p_action not in('remove','demote') or (target_role='admin' and not owner) or (p_action='demote' and not owner) then raise exception 'Ação não permitida.' using errcode='42501'; end if;
 update public.menchat_group_members set active=case when p_action='remove' then false else active end,role=case when p_action='demote' then 'member' else role end where thread_id=p_thread and user_id=target;
 return true;
end;
$$;

create table public.menchat_activity (
 thread_id uuid not null references public.menchat_threads(id), user_id uuid not null references public.menchat_profiles(id),
 received_seq bigint not null default 0, read_seq bigint not null default 0, typing_until timestamptz not null default '-infinity',
 primary key(thread_id,user_id), check(received_seq>=0 and read_seq between 0 and received_seq)
);
alter table public.menchat_activity enable row level security;
revoke all on public.menchat_activity from public,anon,authenticated,service_role;
create function public.menchat_touch(p_thread uuid,p_received bigint,p_read bigint,p_typing boolean) returns void
language plpgsql security definer set search_path='' as $$
declare max_seq bigint; receipts boolean; typing boolean;
begin
 if not menchat_private.can_read_thread(p_thread) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 select coalesce(max(seq),0) into max_seq from public.menchat_messages where thread_id=p_thread;
 if p_received is null or p_read is null or p_received<0 or p_read<0 or p_received>max_seq or p_read>p_received then raise exception 'Confirmação inválida.' using errcode='23514'; end if;
 select read_receipts,show_typing into receipts,typing from public.menchat_profiles where id=auth.uid();
 insert into public.menchat_activity(thread_id,user_id,received_seq,read_seq,typing_until) values(p_thread,auth.uid(),p_received,case when receipts then p_read else 0 end,case when p_typing and typing then clock_timestamp()+interval '6 seconds' else '-infinity' end)
 on conflict(thread_id,user_id) do update set received_seq=greatest(menchat_activity.received_seq,excluded.received_seq),read_seq=greatest(menchat_activity.read_seq,excluded.read_seq),typing_until=excluded.typing_until;
end;
$$;
create function public.menchat_participants(p_thread uuid) returns table(id uuid,name text,status text,avatar_path text,code text,role text,received_seq bigint,read_seq bigint,is_typing boolean,shares_read boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not menchat_private.can_read_thread(p_thread) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 return query select p.id,p.display_name,p.status_message,p.avatar_path,case when p.show_code then p.user_code else null end,
 coalesce(m.role,'member'),coalesce(a.received_seq,0),case when p.read_receipts then coalesce(a.read_seq,0) else null end,
 coalesce(p.show_typing and p.account_status='active' and a.typing_until>now(),false),p.read_receipts
 from public.menchat_threads t join public.menchat_profiles p on
 ((t.kind='private' and p.id in(t.first_user,t.second_user)) or (t.kind='group' and exists(select 1 from public.menchat_group_members gm where gm.thread_id=t.id and gm.user_id=p.id and gm.active)))
 left join public.menchat_group_members m on m.thread_id=t.id and m.user_id=p.id
 left join public.menchat_activity a on a.thread_id=t.id and a.user_id=p.id where t.id=p_thread order by p.display_name,p.id;
end;
$$;
create table public.menchat_uploads (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.menchat_profiles(id),
 thread_id uuid references public.menchat_threads(id), kind text not null check(kind in('image','video','audio','document','avatar')),
 name text not null check(char_length(name) between 1 and 180), mime text not null,
 bytes bigint not null check(bytes between 1 and 25000000), path text not null unique,
 used_by uuid unique references public.menchat_messages(id), created_at timestamptz not null default now(),
 check((kind='avatar' and thread_id is null and used_by is null) or (kind<>'avatar' and thread_id is not null))
);
alter table public.menchat_messages add column attachment_id uuid unique references public.menchat_uploads(id);
alter table public.menchat_messages drop constraint menchat_messages_body_check;
alter table public.menchat_messages add constraint menchat_message_content check(char_length(body)<=4000 and (char_length(btrim(body))>0 or attachment_id is not null));
alter table public.menchat_uploads enable row level security;
revoke all on public.menchat_uploads from public,anon,authenticated,service_role;
create index menchat_uploads_quota on public.menchat_uploads(owner_id,created_at);

create function menchat_private.can_read_upload(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.menchat_uploads u where u.id=p_id and
 (u.kind<>'avatar' and menchat_private.can_read_thread(u.thread_id) and (u.used_by is not null or u.owner_id=auth.uid())));
$$;
create policy menchat_upload_read on public.menchat_uploads for select to authenticated using(menchat_private.can_read_upload(id) or (kind='avatar' and owner_id=(select auth.uid()) and exists(select 1 from public.menchat_profiles where id=auth.uid() and account_status='active')));
grant select on public.menchat_uploads to authenticated;
create function public.menchat_reserve_upload(p_thread uuid,p_name text,p_mime text,p_bytes bigint) returns table(id uuid,path text,kind text)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item uuid:=gen_random_uuid(); category text; target_path text;
begin
 perform 1 from menchat_private.app_state where singleton for update;
 perform 1 from public.menchat_profiles p where p.id=actor and p.account_status='active' for update;
 if not found or (p_thread is not null and not menchat_private.can_send_thread(p_thread)) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 category:=case when p_mime in('image/jpeg','image/png','image/webp','image/gif') then 'image'
 when p_mime in('video/mp4','video/webm','video/quicktime') then 'video'
 when p_mime in('audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm') then 'audio'
 when p_mime in('application/pdf','text/plain','application/zip','application/x-zip-compressed','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') then 'document' else null end;
 if p_thread is null then
  if p_mime not in('image/jpeg','image/png','image/webp') then raise exception 'Foto inválida.' using errcode='23514'; end if;
  category:='avatar';
 end if;
 if category is null or p_bytes is null or p_bytes<1 or p_bytes>(case category when 'avatar' then 200000 when 'image' then 5000000 when 'video' then 25000000 else 10000000 end)
 or p_name is null or char_length(btrim(p_name)) not between 1 and 180 or p_name ~* '\.(exe|msi|bat|cmd|ps1|js|html|svg|sh)$' or p_name ~ '[[:cntrl:]]' then raise exception 'Tipo ou tamanho não permitido.' using errcode='23514'; end if;
 if (select coalesce(sum(bytes),0) from public.menchat_uploads)+p_bytes>500000000 then raise exception 'Armazenamento do aplicativo cheio (500 MB).' using errcode='23514'; end if;
 if (select coalesce(sum(bytes),0) from public.menchat_uploads where owner_id=actor and created_at>now()-interval '1 day')+p_bytes>100000000 then raise exception 'Limite diário de 100 MB atingido.' using errcode='23514'; end if;
 if (select count(*) from public.menchat_uploads u where u.owner_id=actor and u.used_by is null and u.created_at>now()-interval '1 hour' and not exists(select 1 from public.menchat_profiles p where p.avatar_path=u.path))>=5 then raise exception 'Conclua ou descarte os anexos pendentes.' using errcode='23514'; end if;
 target_path:=actor::text||'/'||item::text;
 insert into public.menchat_uploads(id,owner_id,thread_id,kind,name,mime,bytes,path) values(item,actor,p_thread,category,btrim(p_name),p_mime,p_bytes,target_path);
 return query select item,target_path,category;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('menchat-media','menchat-media',false,25000000,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm','application/pdf','text/plain','application/zip','application/x-zip-compressed','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
 ('menchat-avatars','menchat-avatars',false,200000,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function menchat_private.storage_write(p_bucket text,p_path text,p_delete boolean) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare u public.menchat_uploads%rowtype; current_avatar text;
begin
 -- Publicar e apagar concorrem pela mesma reserva: um objeto publicado não pode ser apagado.
 select * into u from public.menchat_uploads where path=p_path for update;
 if not found or u.owner_id<>auth.uid() or u.used_by is not null then return false; end if;
 select avatar_path into current_avatar from public.menchat_profiles where id=auth.uid() and account_status='active';
 if not found or (not p_delete and u.created_at<=now()-interval '1 hour') then return false; end if;
 return (u.kind='avatar' and p_bucket='menchat-avatars' and (not p_delete or current_avatar is distinct from p_path))
 or (u.kind<>'avatar' and p_bucket='menchat-media' and (p_delete or menchat_private.can_send_thread(u.thread_id)));
end;
$$;
create function menchat_private.storage_read(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select case when p_bucket='menchat-media' then exists(select 1 from public.menchat_uploads u where u.path=p_path and menchat_private.can_read_upload(u.id))
 when p_bucket='menchat-avatars' then exists(select 1 from public.menchat_profiles me where me.id=auth.uid() and me.account_status='active' and
 (exists(select 1 from public.menchat_uploads u where u.path=p_path and u.kind='avatar' and u.owner_id=me.id)
 or exists(select 1 from public.menchat_profiles other where other.avatar_path=p_path and other.account_status='active' and exists(select 1 from public.menchat_threads t where menchat_private.can_read_thread(t.id) and
 ((t.kind='private' and other.id in(t.first_user,t.second_user)) or exists(select 1 from public.menchat_group_members m where m.thread_id=t.id and m.user_id=other.id and m.active))))))
 else false end;
$$;
create policy menchat_object_insert on storage.objects for insert to authenticated with check(menchat_private.storage_write(bucket_id,name,false));
create policy menchat_object_read on storage.objects for select to authenticated using(menchat_private.storage_read(bucket_id,name));
create policy menchat_object_delete on storage.objects for delete to authenticated using(menchat_private.storage_write(bucket_id,name,true));
-- Nenhuma política UPDATE: arquivos imutáveis; uploads não usam upsert.
create function public.menchat_send_upload(p_message uuid,p_upload uuid,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u public.menchat_uploads%rowtype; existing public.menchat_messages%rowtype;
begin
 select * into u from public.menchat_uploads where id=p_upload for update;
 if not found or u.owner_id<>auth.uid() or u.kind='avatar' or not menchat_private.can_send_thread(u.thread_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_message is null or p_body is null or char_length(p_body)>4000 then raise exception 'Dados inválidos.' using errcode='23514'; end if;
 if u.used_by is not null then
  select * into existing from public.menchat_messages where id=u.used_by;
  if existing.id=p_message and existing.body=p_body then return existing.id; end if;
  raise exception 'Anexo já utilizado.' using errcode='23514';
 end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='menchat-media' and o.name=u.path and (o.metadata->>'size')::bigint=u.bytes and o.metadata->>'mimetype'=u.mime) then raise exception 'Upload não confirmado ou diferente da reserva.' using errcode='23514'; end if;
 insert into public.menchat_messages(id,thread_id,sender_id,body,attachment_id) values(p_message,u.thread_id,auth.uid(),p_body,u.id);
 update public.menchat_uploads set used_by=p_message where id=u.id;
 return p_message;
end;
$$;
create function public.menchat_cancel_upload(p_upload uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare u public.menchat_uploads%rowtype;
begin
 select * into u from public.menchat_uploads where id=p_upload for update;
 if not found or u.owner_id<>auth.uid() or u.used_by is not null or exists(select 1 from public.menchat_profiles where avatar_path=u.path) then return false; end if;
 if exists(select 1 from storage.objects where name=u.path and bucket_id in('menchat-media','menchat-avatars')) then return false; end if;
 delete from public.menchat_uploads where id=u.id; return true;
end;
$$;
revoke update(avatar_path) on public.menchat_profiles from authenticated;
create function public.menchat_save_profile(p_name text,p_status text,p_show_code boolean,p_lookup boolean,p_read boolean,p_typing boolean,p_avatar uuid default null,p_remove boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare avatar text; current_avatar text;
begin
 select avatar_path into current_avatar from public.menchat_profiles where id=auth.uid() and account_status='active' for update;
 if not found then raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 50 or p_status is null or char_length(p_status)>140 or p_show_code is null or p_lookup is null or p_read is null or p_typing is null then raise exception 'Dados inválidos.' using errcode='23514'; end if;
 avatar:=case when p_remove then null else current_avatar end;
 if p_avatar is not null then
  perform 1 from public.menchat_uploads where id=p_avatar and owner_id=auth.uid() for update;
  select u.path into avatar from public.menchat_uploads u join storage.objects o on o.name=u.path and o.bucket_id='menchat-avatars'
  where u.id=p_avatar and u.owner_id=auth.uid() and u.kind='avatar' and (o.metadata->>'size')::bigint=u.bytes and o.metadata->>'mimetype'=u.mime;
  if avatar is null then raise exception 'Foto não confirmada.' using errcode='23514'; end if;
 end if;
 update public.menchat_profiles set display_name=btrim(p_name),status_message=p_status,avatar_path=avatar,show_code=p_show_code,allow_code_lookup=p_lookup,read_receipts=p_read,show_typing=p_typing where id=auth.uid();
 if not p_read then update public.menchat_activity set read_seq=0 where user_id=auth.uid(); end if;
 if not p_typing then update public.menchat_activity set typing_until='-infinity' where user_id=auth.uid(); end if;
end;
$$;

create function public.menchat_list_chats() returns table(id uuid,name text,can_send boolean,kind text,avatar_path text,creator_id uuid,owner_id uuid,last_body text,last_at timestamptz,last_sender uuid)
language sql stable security definer set search_path='' as $$
 select t.id,case when t.kind='group' then t.group_name else p.display_name end,menchat_private.can_send_thread(t.id),t.kind,p.avatar_path,t.creator_id,t.owner_id,
 case when last.attachment_id is not null then 'Anexo' else last.body end,coalesce(last.created_at,t.created_at),last.sender_id
 from public.menchat_threads t left join public.menchat_profiles p on p.id=case when t.first_user=auth.uid() then t.second_user else t.first_user end
 left join lateral(select body,created_at,attachment_id,sender_id from public.menchat_messages where thread_id=t.id order by seq desc limit 1) last on true
 where menchat_private.can_read_thread(t.id) order by coalesce(last.created_at,t.created_at) desc,t.id;
$$;

-- Serializa envio de texto/mídia com remoções e saídas do grupo.
create function menchat_private.guard_message() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.menchat_threads where id=new.thread_id for share;
 if new.sender_id is distinct from auth.uid() or not menchat_private.can_send_thread(new.thread_id) then raise exception 'Envio não permitido.' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function menchat_private.guard_message() from public,anon,authenticated,service_role;
create trigger menchat_guard_message before insert on public.menchat_messages for each row execute function menchat_private.guard_message();

-- Somente RPCs públicas específicas; tabelas administrativas não são editáveis pelo cliente.
revoke all on function menchat_private.find_code(text),menchat_private.can_read_upload(uuid),menchat_private.storage_write(text,text,boolean),menchat_private.storage_read(text,text) from public,anon,authenticated,service_role;
grant execute on function menchat_private.can_read_upload(uuid),menchat_private.storage_write(text,text,boolean),menchat_private.storage_read(text,text) to authenticated;
revoke all on function public.menchat_create_group(text,text[]),public.menchat_manage_group(uuid,text,uuid,text,text),public.menchat_touch(uuid,bigint,bigint,boolean),public.menchat_participants(uuid),public.menchat_list_chats(),public.menchat_reserve_upload(uuid,text,text,bigint),public.menchat_send_upload(uuid,uuid,text),public.menchat_cancel_upload(uuid),public.menchat_save_profile(text,text,boolean,boolean,boolean,boolean,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.menchat_create_group(text,text[]),public.menchat_manage_group(uuid,text,uuid,text,text),public.menchat_touch(uuid,bigint,bigint,boolean),public.menchat_participants(uuid),public.menchat_list_chats(),public.menchat_reserve_upload(uuid,text,text,bigint),public.menchat_send_upload(uuid,uuid,text),public.menchat_cancel_upload(uuid),public.menchat_save_profile(text,text,boolean,boolean,boolean,boolean,uuid,boolean) to authenticated;
insert into menchat_private.schema_migrations(version) values('20261104000500_complete_chat');
commit;
