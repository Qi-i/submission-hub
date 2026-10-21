-- Submission Hub: academic mail index (original .eml files remain in the independent collector archive).
-- All data is private to the signed-in owner. No email passwords or OAuth refresh tokens are stored here.
create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  display_name text not null default '',
  provider text not null default 'coremail' check (provider in ('coremail','qq','126','gmail','outlook','other')),
  enabled boolean not null default true,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id,address)
);
create index if not exists mail_accounts_owner_idx on public.mail_accounts(user_id);
alter table public.mail_accounts enable row level security;
grant select,insert,update,delete on public.mail_accounts to authenticated;
create policy "mail_accounts_select" on public.mail_accounts for select to authenticated using ((select auth.uid())=user_id);
create policy "mail_accounts_insert" on public.mail_accounts for insert to authenticated with check ((select auth.uid())=user_id);
create policy "mail_accounts_update" on public.mail_accounts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "mail_accounts_delete" on public.mail_accounts for delete to authenticated using ((select auth.uid())=user_id);

create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.mail_accounts(id) on delete cascade,
  remote_key text not null,
  first_folder text not null default 'INBOX',
  last_folder text not null default 'INBOX',
  internet_message_id text,
  received_at timestamptz,
  sender_name text,
  sender_address text,
  recipient_address text,
  subject text not null default '',
  snippet text not null default '',
  body_text text not null default '',
  category text not null default 'other' check (category in ('review_invite','submission_update','editorial','other','suspicious')),
  importance smallint not null default 0 check (importance between 0 and 3),
  extraction jsonb not null default '{}'::jsonb,
  deadline date,
  paper_id uuid references public.papers(id) on delete set null,
  review_response text check (review_response in ('pending','accepted','declined','completed')),
  archived_locally boolean not null default false,
  first_saved_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(account_id,remote_key)
);
create index if not exists mail_messages_owner_date_idx on public.mail_messages(user_id,received_at desc);
create index if not exists mail_messages_account_idx on public.mail_messages(account_id,received_at desc);
create index if not exists mail_messages_category_idx on public.mail_messages(user_id,category,received_at desc);
create index if not exists mail_messages_paper_idx on public.mail_messages(paper_id);
alter table public.mail_messages enable row level security;
grant select,insert,update,delete on public.mail_messages to authenticated;
create policy "mail_messages_select" on public.mail_messages for select to authenticated using ((select auth.uid())=user_id);
create policy "mail_messages_insert" on public.mail_messages for insert to authenticated with check (
  (select auth.uid())=user_id
  and exists (select 1 from public.mail_accounts a where a.id=account_id and a.user_id=user_id)
  and (paper_id is null or exists (select 1 from public.papers p where p.id=paper_id and p.user_id=user_id))
);
create policy "mail_messages_update" on public.mail_messages for update to authenticated using ((select auth.uid())=user_id) with check (
  (select auth.uid())=user_id
  and exists (select 1 from public.mail_accounts a where a.id=account_id and a.user_id=user_id)
  and (paper_id is null or exists (select 1 from public.papers p where p.id=paper_id and p.user_id=user_id))
);
create policy "mail_messages_delete" on public.mail_messages for delete to authenticated using ((select auth.uid())=user_id);

-- Only SHA-256 digests are stored; the raw collector token is shown once in the browser.
create table if not exists public.mail_collector_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '本地采集器',
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists mail_collector_keys_owner_idx on public.mail_collector_keys(user_id);
alter table public.mail_collector_keys enable row level security;
grant select,insert,update,delete on public.mail_collector_keys to authenticated;
create policy "mail_collector_keys_select" on public.mail_collector_keys for select to authenticated using ((select auth.uid())=user_id);
create policy "mail_collector_keys_insert" on public.mail_collector_keys for insert to authenticated with check ((select auth.uid())=user_id);
create policy "mail_collector_keys_update" on public.mail_collector_keys for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "mail_collector_keys_delete" on public.mail_collector_keys for delete to authenticated using ((select auth.uid())=user_id);
