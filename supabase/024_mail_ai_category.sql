-- Independent AI suggestion, never overwrites a user's original/manual category.
alter table public.mail_messages add column if not exists ai_category text
check(ai_category in ('review_invite','submission_update','editorial','other','suspicious'));
create index if not exists mail_ai_category_owner_idx on public.mail_messages(user_id,ai_category);