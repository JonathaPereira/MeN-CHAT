-- Prévias solicitadas pelo proprietário; dados somente para o destinatário autorizado.
begin;
create function public.menchat_native_preview(p_event uuid,p_user uuid,p_thread uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('title',left(p.display_name,60),'body',left(case when m.body<>'' then m.body when u.is_sticker then 'Figurinha' when u.kind='image' then 'Foto' when u.kind='video' then 'Vídeo' when u.kind='audio' then 'Áudio' else 'Anexo' end,161))
 from public.menchat_messages m join public.menchat_profiles p on p.id=m.sender_id left join public.menchat_uploads u on u.id=m.attachment_id
 where m.id=p_event and m.thread_id=p_thread and m.sender_id<>p_user
 and menchat_private.native_event_valid(m.id,'message',p_user,p_thread)), '{}'::jsonb);
$$;
revoke all on function public.menchat_native_preview(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.menchat_native_preview(uuid,uuid,uuid) to service_role;
insert into menchat_private.schema_migrations(version) values('20261105001100_notification_previews');
commit;
