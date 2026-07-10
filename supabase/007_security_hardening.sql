-- Submission Hub — Migration 007: security hardening

-- User profiles are private by default. Each user may read only their own profile.
-- Administrative cross-user reads are performed by the protected admin-stats Edge Function.
DROP POLICY IF EXISTS "Public read profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Read own profile" ON public.user_profiles;

CREATE POLICY "Read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Ensure updates cannot change another user's row through a crafted request.
DROP POLICY IF EXISTS "Update own profile" ON public.user_profiles;
CREATE POLICY "Update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
