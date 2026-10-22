-- Chunked translation supports long mail without truncating at 8,500 chars.
-- Progress persists between retries; only the message owner can read it.
alter table public.mail_translations
 drop constraint if exists mail_translations_translated_text_check;

create table if not exists public.mail_translation_chunks (
 user_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid not null references public.mail_messages(id) on delete cascade,
 target_language text not null check (target_language in ('zh','en')),
 source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
 chunk_index integer not null check (chunk_index>=0 and chunk_index<1000),
 translated_text text not null check (char_length(translated_text)<=24000),
 model_name text not null,
 updated_at timestamptz not null default now(),
 primary key (user_id,message_id,target_language,source_hash,chunk_index)
);
alter table public.mail_translation_chunks enable row level security;
create policy mail_translation_chunks_owner_read
 on public.mail_translation_chunks for select to authenticated
 using ((select auth.uid())=user_id);
create policy mail_translation_chunks_owner_insert
 on public.mail_translation_chunks for insert to authenticated
 with check ((select auth.uid())=user_id);
create policy mail_translation_chunks_owner_update
 on public.mail_translation_chunks for update to authenticated
 using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
grant select,insert,update on public.mail_translation_chunks to authenticated;

-- Index lookup for resumable segmented translation and account cleanup.
create index if not exists mail_translation_chunks_message_idx
 on public.mail_translation_chunks(message_id,target_language,source_hash);
