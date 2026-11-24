# QiHub native paper and review-event adapter

The original authenticated Submission Hub owns every mutation in `src/integrations/qihubPaperTimelineCrud.ts`. The adapter is exposed only if the Android `QiHubNativeTopicCrud` WebView bridge exists. This is not a new user store and never forwards credentials.

`mutateQiHubPaper` validates all 35 editable columns of `public.papers`. It does **not** accept the `files`, `id`, `user_id`, `created_at` or `updated_at` fields from Android. Existing private attachments are preserved on update. Deletion is refused when managed attachment records remain or another source table references the paper (review events, manuscript drafts, or resubmission descendants). A successful mutation must return the expected source database row; update/delete uses the exact old `updated_at` predicate.

`mutateQiHubTimelineEvent` manages `public.timeline_events`: `paper_id`, `event_date`, `event_label`, `event_note`. Creation and update confirm the paper belongs to the current account. Since the source schema has no event-level `updated_at` column, update and deletion are conditional on the old four editable fields (including `.is('event_note', null)` when the old note was absent) so an intervening change does not silently disappear.

Verification: `node tests/qihub-native-paper-timeline-crud.mjs` and `npm run verify`. The original website remains the way to upload, inspect and delete private paper attachments; native Android only displays existing file references.
