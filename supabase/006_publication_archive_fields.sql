-- Submission Hub — Migration 006: publication archive and journal profile fields

ALTER TABLE public.papers
  ADD COLUMN IF NOT EXISTS doi TEXT,
  ADD COLUMN IF NOT EXISTS publication_info TEXT,
  ADD COLUMN IF NOT EXISTS citation TEXT,
  ADD COLUMN IF NOT EXISTS journal_url TEXT,
  ADD COLUMN IF NOT EXISTS journal_apc_note TEXT;
