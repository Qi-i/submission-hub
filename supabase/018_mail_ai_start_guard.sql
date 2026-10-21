-- Prevent newly enabled AI from implicitly backfilling all historic mail.
alter table public.mail_preferences add column if not exists ai_started_at timestamptz;
