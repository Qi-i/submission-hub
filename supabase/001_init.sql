-- ═══════════════════════════════════════════════════════════
-- Submission Hub — Migration 001: Initial Schema
-- ═══════════════════════════════════════════════════════════

-- ── User Profiles ──
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles"
  ON public.user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── Papers ──
CREATE TABLE IF NOT EXISTS public.papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '未命名',
  title_zh TEXT,
  journal TEXT,
  status TEXT NOT NULL DEFAULT 'preparing',
  lang TEXT NOT NULL DEFAULT 'zh',
  quartile_jcr TEXT DEFAULT '未定',
  quartile_cas TEXT DEFAULT '未定',
  quartile_new TEXT DEFAULT '无',
  quartile_cust TEXT DEFAULT '无',
  quartile_zh TEXT[] DEFAULT '{}',
  authors TEXT[] DEFAULT '{}',
  submitted_date DATE,
  resolve_date DATE,
  deadline DATE,
  tracking_url TEXT,
  timeline TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  prev_id UUID REFERENCES public.papers(id) ON DELETE SET NULL,
  files JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own papers"
  ON public.papers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own papers"
  ON public.papers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own papers"
  ON public.papers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Delete own papers"
  ON public.papers FOR DELETE
  USING (auth.uid() = user_id);

-- ── Timeline Events ──
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_label TEXT NOT NULL,
  event_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own timeline events"
  ON public.timeline_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own timeline events"
  ON public.timeline_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own timeline events"
  ON public.timeline_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Delete own timeline events"
  ON public.timeline_events FOR DELETE
  USING (auth.uid() = user_id);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON public.papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_status ON public.papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_authors ON public.papers USING GIN(authors);
CREATE INDEX IF NOT EXISTS idx_timeline_paper_id ON public.timeline_events(paper_id);

-- ── Storage bucket for paper files ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('paper-files', 'paper-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Read own files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'paper-files' AND auth.uid() = (storage.foldername(name))[1]);

CREATE POLICY "Upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'paper-files' AND auth.uid() = (storage.foldername(name))[1]);

CREATE POLICY "Delete own files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'paper-files' AND auth.uid() = (storage.foldername(name))[1]);
