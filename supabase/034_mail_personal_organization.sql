-- Academic mail personal organization (virtual; never moves a message at its provider).
create table if not exists public.mail_folders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 40),
 color text not null default '#5B83E9' check (color ~ '^#[0-9a-fA-F]{6}$'),
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 unique(user_id,name),
 unique(user_id,id)
);
create table if not exists public.mail_labels (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 28),
 color text not null default '#8B72E6' check (color ~ '^#[0-9a-fA-F]{6}$'),
 created_at timestamptz not null default now(),
 unique(user_id,name)
);
alter table public.mail_accounts
 add column if not exists short_label text not null default ''
  check(char_length(short_label)<=18),
 add column if not exists logo_symbol text not null default ''
  check(char_length(logo_symbol)<=8),
 add column if not exists logo_url text
  check(logo_url is null or (char_length(logo_url)<=600 and logo_url ~ '^https://[A-Za-z0-9.-]+/'));
alter table public.mail_messages
 add column if not exists user_note text not null default ''
  check(char_length(user_note)<=10000),
 add column if not exists user_labels text[] not null default '{}'::text[]
  check(cardinality(user_labels)<=24),
 add column if not exists virtual_folder_id uuid;
create index if not exists mail_messages_virtual_folder on public.mail_messages(user_id,virtual_folder_id,received_at desc);
alter table public.mail_messages add constraint mail_messages_virtual_folder_owner_fk
 foreign key (user_id,virtual_folder_id) references public.mail_folders(user_id,id)
 on delete set null (virtual_folder_id);
create table if not exists public.mail_translations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid not null references public.mail_messages(id) on delete cascade,
 target_language text not null check(target_language in('zh','en')),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 translated_text text not null check(char_length(translated_text)<=25000),
 model_name text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,message_id,target_language)
);
create index if not exists mail_translations_owner_msg on public.mail_translations(user_id,message_id);
alter table public.mail_folders enable row level security;
alter table public.mail_labels enable row level security;
alter table public.mail_translations enable row level security;
grant select,insert,update,delete on public.mail_folders,public.mail_labels,public.mail_translations to authenticated;
create policy mail_folders_owner on public.mail_folders for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy mail_labels_owner on public.mail_labels for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy mail_translations_owner on public.mail_translations for all to authenticated
 using ((select auth.uid())=user_id and exists (select 1 from public.mail_messages m
 where m.id=message_id and m.user_id=user_id))
 with check ((select auth.uid())=user_id and exists (select 1 from public.mail_messages m
 where m.id=message_id and m.user_id=user_id));
