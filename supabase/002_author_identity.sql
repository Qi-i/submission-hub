-- ═══════════════════════════════════════════════════════════
-- Submission Hub — Migration 002: Author Identity & Corresponding Author
-- ═══════════════════════════════════════════════════════════

-- Add author_name to user_profiles (real name used in academic papers)
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS author_name TEXT;

-- Add corresponding_author to papers (name of the corresponding author)
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS corresponding_author TEXT;
