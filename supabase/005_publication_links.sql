-- Submission Hub — Migration 005: publication links

ALTER TABLE public.papers
  ADD COLUMN IF NOT EXISTS published_url TEXT;
