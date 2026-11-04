-- Somente no SQL Editor pelo proprietário, para um teste controlado com segunda conta.
-- A identidade deve ser provisionada no Auth e passar pelo OTP antes desta ativação.
-- Não substitui convites de cadastro pelo aplicativo.
begin;
do $$
declare target uuid; email_target text := lower(btrim('EMAIL_DO_CONVIDADO_AQUI'));
begin
 if strpos(email_target,'@')<2 then raise exception 'Informe o e-mail do convidado.'; end if;
 select id into strict target from auth.users where lower(email)=email_target and email_confirmed_at is not null;
 insert into public.menchat_profiles(id,display_name,account_status,app_role)
 values(target,'Contato de teste','active','member') on conflict(id) do update set account_status='active';
end $$;
select 'MEMBRO_OK' as resultado;
commit;
