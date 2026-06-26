-- ═══════════════════════════════════════════════════════════
-- Submission Hub — Migration 003: Submission workflow tracking
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.papers
  ADD COLUMN IF NOT EXISTS manuscript_no TEXT,
  ADD COLUMN IF NOT EXISTS submission_system TEXT,
  ADD COLUMN IF NOT EXISTS system_status TEXT,
  ADD COLUMN IF NOT EXISTS last_status_date DATE,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS reminder_level TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS apc_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS apc_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS revision_round INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followup_log TEXT;

CREATE INDEX IF NOT EXISTS idx_papers_system_status ON public.papers(system_status);
CREATE INDEX IF NOT EXISTS idx_papers_last_status_date ON public.papers(last_status_date);
CREATE INDEX IF NOT EXISTS idx_papers_next_action ON public.papers(next_action);
