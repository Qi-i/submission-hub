-- Submission Hub — Migration 012: journal selection metadata
-- All fields remain protected by the existing owner-scoped journal_profiles RLS policies.

ALTER TABLE public.journal_profiles
  ADD COLUMN IF NOT EXISTS name_zh TEXT,
  ADD COLUMN IF NOT EXISTS official_abbreviation TEXT,
  ADD COLUMN IF NOT EXISTS scope_zh TEXT,
  ADD COLUMN IF NOT EXISTS selection_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selection_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_journal_profiles_selection_tags
  ON public.journal_profiles USING GIN(selection_tags);

COMMENT ON COLUMN public.journal_profiles.name_zh IS 'User-verified Chinese journal name translation.';
COMMENT ON COLUMN public.journal_profiles.official_abbreviation IS 'Official journal abbreviation from the publisher or bibliographic database.';
COMMENT ON COLUMN public.journal_profiles.scope_zh IS 'User-verified Chinese translation or summary of the journal aims and scope.';
COMMENT ON COLUMN public.journal_profiles.selection_tags IS 'Personal journal-selection tags such as primary target, backup, fast review, or method preference.';
COMMENT ON COLUMN public.journal_profiles.selection_notes IS 'Personal fit assessment and journal-selection notes.';
