-- Existing ready mailboxes continue low-frequency incremental scans.
-- A mailbox that fails is paused for user-triggered diagnosis; don't retry it
-- on a timer. Preserve message archives and the last successful sync timestamp.
select cron.schedule(
 'submission_hub_cloud_mail_10min','*/10 * * * *',
 $job$
 select net.http_post(
  url:='https://grrwxtlauqcfnerckijn.supabase.co/functions/v1/mail-cloud-collector',
  headers:=jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets
      where name='sh_mail_cloud_cron_key' limit 1)),
  body:='{}'::jsonb, timeout_milliseconds:=100000
 ) as request_id
 where exists (
  select 1 from public.mail_accounts
  where enabled is true and cloud_state = 'ready'
 );
 $job$
);
-- Clear misleading old retry deadlines but keep the failure count and reason.
update public.mail_accounts set next_attempt_at=null
where cloud_state='error' and next_attempt_at is not null;
