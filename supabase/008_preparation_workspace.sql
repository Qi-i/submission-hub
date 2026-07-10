-- Submission Hub — Migration 008: preparation workspace

CREATE TABLE IF NOT EXISTS public.journal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  publisher TEXT,
  website_url TEXT,
  author_guide_url TEXT,
  submission_url TEXT,
  third_party_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  issn TEXT,
  eissn TEXT,
  scope TEXT,
  subject_tags TEXT[] NOT NULL DEFAULT '{}',
  indexing TEXT[] NOT NULL DEFAULT '{}',
  jcr_quartile TEXT,
  cas_quartile TEXT,
  impact_factor NUMERIC,
  oa_type TEXT NOT NULL DEFAULT 'unknown' CHECK (oa_type IN ('unknown', 'closed', 'hybrid', 'gold', 'diamond')),
  apc_amount NUMERIC CHECK (apc_amount IS NULL OR apc_amount >= 0),
  apc_currency TEXT DEFAULT 'USD',
  fee_notes TEXT,
  first_decision_days INTEGER CHECK (first_decision_days IS NULL OR first_decision_days >= 0),
  total_review_days INTEGER CHECK (total_review_days IS NULL OR total_review_days >= 0),
  acceptance_rate NUMERIC CHECK (acceptance_rate IS NULL OR (acceptance_rate >= 0 AND acceptance_rate <= 100)),
  risk_level TEXT NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('normal', 'watch', 'warning')),
  is_favorite BOOLEAN NOT NULL DEFAULT TRUE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.research_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  research_question TEXT,
  objective TEXT,
  novelty TEXT,
  background TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  methods TEXT[] NOT NULL DEFAULT '{}',
  data_sources TEXT[] NOT NULL DEFAULT '{}',
  target_audience TEXT,
  expected_output TEXT,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'literature', 'data', 'analysis', 'drafting', 'paused', 'abandoned')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  novelty_score INTEGER NOT NULL DEFAULT 3 CHECK (novelty_score BETWEEN 0 AND 5),
  feasibility_score INTEGER NOT NULL DEFAULT 3 CHECK (feasibility_score BETWEEN 0 AND 5),
  data_score INTEGER NOT NULL DEFAULT 3 CHECK (data_score BETWEEN 0 AND 5),
  method_score INTEGER NOT NULL DEFAULT 3 CHECK (method_score BETWEEN 0 AND 5),
  timeline_score INTEGER NOT NULL DEFAULT 3 CHECK (timeline_score BETWEEN 0 AND 5),
  deadline DATE,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.manuscript_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.research_topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  article_type TEXT NOT NULL DEFAULT 'Research Article',
  language TEXT NOT NULL DEFAULT 'en',
  stage TEXT NOT NULL DEFAULT 'outline' CHECK (stage IN ('outline', 'writing', 'internal_review', 'journal_adaptation', 'submission_ready', 'submitted', 'paused')),
  abstract TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  outline TEXT,
  authors TEXT[] NOT NULL DEFAULT '{}',
  target_word_count INTEGER CHECK (target_word_count IS NULL OR target_word_count >= 0),
  current_word_count INTEGER NOT NULL DEFAULT 0 CHECK (current_word_count >= 0),
  figure_count INTEGER NOT NULL DEFAULT 0 CHECK (figure_count >= 0),
  table_count INTEGER NOT NULL DEFAULT 0 CHECK (table_count >= 0),
  reference_count INTEGER NOT NULL DEFAULT 0 CHECK (reference_count >= 0),
  deadline DATE,
  external_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_journal_ids UUID[] NOT NULL DEFAULT '{}',
  primary_journal_id UUID REFERENCES public.journal_profiles(id) ON DELETE SET NULL,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  submitted_paper_id UUID REFERENCES public.papers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.journal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manuscript_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own journal profiles" ON public.journal_profiles;
DROP POLICY IF EXISTS "Insert own journal profiles" ON public.journal_profiles;
DROP POLICY IF EXISTS "Update own journal profiles" ON public.journal_profiles;
DROP POLICY IF EXISTS "Delete own journal profiles" ON public.journal_profiles;
CREATE POLICY "Read own journal profiles" ON public.journal_profiles FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Insert own journal profiles" ON public.journal_profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Update own journal profiles" ON public.journal_profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Delete own journal profiles" ON public.journal_profiles FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Read own research topics" ON public.research_topics;
DROP POLICY IF EXISTS "Insert own research topics" ON public.research_topics;
DROP POLICY IF EXISTS "Update own research topics" ON public.research_topics;
DROP POLICY IF EXISTS "Delete own research topics" ON public.research_topics;
CREATE POLICY "Read own research topics" ON public.research_topics FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Insert own research topics" ON public.research_topics FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Update own research topics" ON public.research_topics FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Delete own research topics" ON public.research_topics FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Read own manuscript drafts" ON public.manuscript_drafts;
DROP POLICY IF EXISTS "Insert own manuscript drafts" ON public.manuscript_drafts;
DROP POLICY IF EXISTS "Update own manuscript drafts" ON public.manuscript_drafts;
DROP POLICY IF EXISTS "Delete own manuscript drafts" ON public.manuscript_drafts;
CREATE POLICY "Read own manuscript drafts" ON public.manuscript_drafts FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Insert own manuscript drafts" ON public.manuscript_drafts FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Update own manuscript drafts" ON public.manuscript_drafts FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Delete own manuscript drafts" ON public.manuscript_drafts FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_journal_profiles_user_id ON public.journal_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_profiles_favorite ON public.journal_profiles(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_journal_profiles_tags ON public.journal_profiles USING GIN(subject_tags);
CREATE INDEX IF NOT EXISTS idx_research_topics_user_status ON public.research_topics(user_id, status);
CREATE INDEX IF NOT EXISTS idx_research_topics_deadline ON public.research_topics(user_id, deadline);
CREATE INDEX IF NOT EXISTS idx_manuscript_drafts_user_stage ON public.manuscript_drafts(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_manuscript_drafts_topic_id ON public.manuscript_drafts(topic_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_drafts_primary_journal ON public.manuscript_drafts(primary_journal_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_drafts_target_journals ON public.manuscript_drafts USING GIN(target_journal_ids);
