# Submission tracking enhancement

This branch adds practical manuscript workflow tracking for Submission Hub.

## New paper fields

- `manuscript_no`: manuscript / submission ID
- `submission_system`: ScholarOne, Editorial Manager, Taylor & Francis Submission Portal, etc.
- `system_status`: the original status shown in the journal system, such as `With Editor`, `Out for Review`, `Decision Pending`, or `Revision Required`
- `last_status_date`: the last date when the system status changed
- `next_action`: the next manual action to take
- `reminder_level`: `none`, `watch`, `warn`, or `urgent`
- `revision_round`: revision round number
- `apc_amount` and `apc_currency`: APC / page charge tracking
- `followup_log`: reminder, CONTACT, and editorial-office communication notes

## Database migrations

The online Supabase project has already been migrated. For a new environment, run these migrations in order:

```sql
supabase/003_submission_tracking.sql
supabase/004_rls_and_index_tuning.sql
```

If `003_submission_tracking.sql` is not applied, saving records with the new fields will fail because the database will not yet have those columns.

## UI changes

- The paper form now includes a dedicated “投稿系统跟踪” panel.
- Paper cards display manuscript ID, submission system, original system status, revision round, APC, and an automatic next-action prompt.
- Automatic prompts are generated for long `With Editor`, `Decision Pending`, and `Out for Review` / `Under Review` periods.

## Database tuning

- Added indexes for `papers.prev_id` and `timeline_events.user_id`.
- Recreated ownership RLS policies with `(select auth.uid())` to avoid repeated per-row function evaluation.
- Added `WITH CHECK` clauses to update policies so rows cannot be reassigned across users.

## Admin configuration

The former hard-coded frontend admin ID has been replaced by `VITE_ADMIN_ID`. Add this value to the deployment environment if the admin panel should remain enabled.

## Validation

The PR check workflow passes both online and offline builds:

```bash
npm ci
npm run build
npm run build:offline
```
