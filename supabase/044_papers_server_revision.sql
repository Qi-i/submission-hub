-- Submission Hub manuscript concurrency guard (proposed; NOT applied to production).
-- Keeps legacy updated_at optimistic predicates changing on every UPDATE,
-- and introduces a monotonic row_version for the next client CAS revision.
-- Review the live schema and existing triggers BEFORE applying this migration.

ALTER TABLE public.papers
  ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.papers_increment_row_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.row_version := OLD.row_version + 1;
  NEW.updated_at := GREATEST(
    clock_timestamp(),
    COALESCE(OLD.updated_at, clock_timestamp()) + interval '1 microsecond'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papers_update_version ON public.papers;
CREATE TRIGGER papers_update_version
BEFORE UPDATE ON public.papers
FOR EACH ROW
EXECUTE FUNCTION public.papers_increment_row_version();

-- This function is only invoked by a database trigger, never by application RPC.
REVOKE ALL ON FUNCTION public.papers_increment_row_version() FROM PUBLIC;
