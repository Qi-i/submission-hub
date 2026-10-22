-- Temporary free-model 429s must not permanently mark a message as failed.
-- Do not retry an overloaded model on every ten-minute cron tick.
alter table public.mail_preferences
 add column if not exists ai_retry_after timestamptz;
