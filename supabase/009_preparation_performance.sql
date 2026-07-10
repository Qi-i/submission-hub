-- Submission Hub — Migration 009: preparation workspace performance

CREATE INDEX IF NOT EXISTS idx_manuscript_drafts_submitted_paper_id
  ON public.manuscript_drafts(submitted_paper_id);
