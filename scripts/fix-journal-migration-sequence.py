from pathlib import Path

root = Path(__file__).resolve().parents[1]
old = root / 'supabase/011_journal_selection_metadata.sql'
new = root / 'supabase/012_journal_selection_metadata.sql'
if not old.exists():
    raise SystemExit('Expected migration 011_journal_selection_metadata.sql was not found')
content = old.read_text(encoding='utf-8').replace('Migration 011:', 'Migration 012:', 1)
new.write_text(content, encoding='utf-8')
old.unlink()

readme = root / 'README.md'
text = readme.read_text(encoding='utf-8')
text = text.replace('`supabase/001` 至 `supabase/011`', '`supabase/001` 至 `supabase/012`', 1)
old_line = '`008_preparation_workspace.sql` 创建期刊库、研究选题和草稿准备三张表；`009_preparation_performance.sql` 补充草稿转投稿关联索引；`010_journal_rank_cache.sql` 增加期刊等级快照、缓存和服务端限流；`011_external_api_hardening.sql` 为缓存与限流表增加显式拒绝策略并清理无用索引。'
new_line = old_line[:-1] + '；`012_journal_selection_metadata.sql` 增加中文译名、官方缩写、中文简介、选刊标签和选刊备注字段。'
if old_line not in text:
    raise SystemExit('README migration summary was not found')
readme.write_text(text.replace(old_line, new_line, 1), encoding='utf-8')

check = root / 'scripts/check-journal-selection-metadata.mjs'
check_text = check.read_text(encoding='utf-8')
check_text = check_text.replace('supabase/011_journal_selection_metadata.sql', 'supabase/012_journal_selection_metadata.sql')
check.write_text(check_text, encoding='utf-8')

for transient in [root / 'scripts/fix-journal-migration-sequence.py', root / '.github/workflows/fix-journal-migration-sequence.yml']:
    if transient.exists():
        transient.unlink()
