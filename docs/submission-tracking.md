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

## Database migration

Run this migration in Supabase SQL Editor before using the enhanced form online:

```sql
supabase/003_submission_tracking.sql
```

If the migration is not applied, saving a record with the new fields will fail because the online database does not yet have those columns.

## UI changes

- The paper form now includes a dedicated “投稿系统跟踪” panel.
- Paper cards display manuscript ID, submission system, original system status, revision round, APC, and an automatic next-action prompt.
- Automatic prompts are generated for long `With Editor`, `Decision Pending`, and `Out for Review` / `Under Review` periods.

## Admin configuration

The former hard-coded frontend admin ID has been replaced by `VITE_ADMIN_ID`. Add this value to the deployment environment if the admin panel should remain enabled.
