import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../supabase/044_papers_server_revision.sql', import.meta.url), 'utf8');

test('proposed row revision trigger is per-row, monotonic and owner-RLS neutral', () => {
  assert.match(schema, /ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 1/i);
  assert.match(schema, /NEW\.row_version\s*:=\s*OLD\.row_version\s*\+\s*1/i);
  assert.match(schema, /NEW\.updated_at\s*:=\s*GREATEST/i);
  assert.match(schema, /BEFORE UPDATE ON public\.papers\s+FOR EACH ROW/i);
  assert.match(schema, /SECURITY INVOKER/i);
  assert.doesNotMatch(schema, /SECURITY DEFINER/i);
  assert.match(schema, /REVOKE ALL ON FUNCTION .* FROM PUBLIC/i);
});
