-- ═══════════════════════════════════════════════════════════
-- Submission Hub — Migration 004: RLS and index tuning
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_papers_prev_id ON public.papers(prev_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_user_id ON public.timeline_events(user_id);

DROP POLICY IF EXISTS "Insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.user_profiles;
CREATE POLICY "Insert own profile" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "Update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Read own papers" ON public.papers;
DROP POLICY IF EXISTS "Insert own papers" ON public.papers;
DROP POLICY IF EXISTS "Update own papers" ON public.papers;
DROP POLICY IF EXISTS "Delete own papers" ON public.papers;
CREATE POLICY "Read own papers" ON public.papers
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Insert own papers" ON public.papers
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Update own papers" ON public.papers
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Delete own papers" ON public.papers
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Read own timeline events" ON public.timeline_events;
DROP POLICY IF EXISTS "Insert own timeline events" ON public.timeline_events;
DROP POLICY IF EXISTS "Update own timeline events" ON public.timeline_events;
DROP POLICY IF EXISTS "Delete own timeline events" ON public.timeline_events;
CREATE POLICY "Read own timeline events" ON public.timeline_events
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Insert own timeline events" ON public.timeline_events
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Update own timeline events" ON public.timeline_events
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Delete own timeline events" ON public.timeline_events
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
