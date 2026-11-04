-- Configuração única pelo proprietário, após a migração 8 e as variáveis da Vercel.
-- Antes, no Supabase → Integrations → Vault, crie o segredo
-- menchat_push_cron_secret com o MESMO valor de MENCHAT_PUSH_CRON_SECRET da Vercel.
-- Não cole segredos neste arquivo nem os versione.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='menchat_push_cron_secret' and length(decrypted_secret)>=32) then
  raise exception 'Crie menchat_push_cron_secret no Vault antes de agendar.';
 end if;
 if exists(select 1 from cron.job where jobname='menchat-push-every-minute') then
  perform cron.unschedule('menchat-push-every-minute');
 end if;
end $$;
select cron.schedule('menchat-push-every-minute','* * * * *',$job$
 select net.http_post(
  url:='https://men-chat.vercel.app/api/push/dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='menchat_push_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=10000
 );
$job$);
