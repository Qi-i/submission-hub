-- GPT-controlled academic mail mode (2026-10-22).
-- Stop model calls driven by pg_cron; this does not delete saved keys,
-- existing analysis, message bodies, or per-folder history cursors.
update public.mail_preferences set ai_enabled=false where ai_enabled=true;
select cron.unschedule('submission_hub_mail_free_ai_10min')
 where exists(select 1 from cron.job where jobname='submission_hub_mail_free_ai_10min');
-- IMAP/Graph collection remains separately scheduled. IMAP generally has no
-- provider webhook, so a brief metadata check is needed to detect new mail.
-- Mail AI is only invoked after an explicit user action via ChatGPT/database.
