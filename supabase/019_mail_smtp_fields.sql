alter table public.mail_accounts add column if not exists smtp_host text;
alter table public.mail_accounts add column if not exists smtp_port integer not null default 465;
