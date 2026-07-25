from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise RuntimeError(f"Expected source block not found in {path}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


# 1. Durable journal selection metadata fields.
replace_once(
    "src/lib/preparation.ts",
    "  name: string\n  publisher: string | null\n",
    "  name: string\n  name_zh: string | null\n  official_abbreviation: string | null\n  publisher: string | null\n",
)
replace_once(
    "src/lib/preparation.ts",
    "  scope: string | null\n  subject_tags: string[]\n  indexing: string[]\n",
    "  scope: string | null\n  scope_zh: string | null\n  subject_tags: string[]\n  selection_tags: string[]\n  indexing: string[]\n",
)
replace_once(
    "src/lib/preparation.ts",
    "  priority: PriorityLevel\n  notes: string | null\n",
    "  priority: PriorityLevel\n  selection_notes: string | null\n  notes: string | null\n",
)

# 2. Offline persistence preserves the same schema as Supabase.
replace_once(
    "src/lib/local-preparation-store.ts",
    "    name: input.name.trim() || '未命名期刊',\n    publisher: input.publisher || null,\n",
    "    name: input.name.trim() || '未命名期刊',\n    name_zh: input.name_zh || null,\n    official_abbreviation: input.official_abbreviation || null,\n    publisher: input.publisher || null,\n",
)
replace_once(
    "src/lib/local-preparation-store.ts",
    "    scope: input.scope || null,\n    subject_tags: input.subject_tags || [],\n    indexing: input.indexing || [],\n",
    "    scope: input.scope || null,\n    scope_zh: input.scope_zh || null,\n    subject_tags: input.subject_tags || [],\n    selection_tags: input.selection_tags || [],\n    indexing: input.indexing || [],\n",
)
replace_once(
    "src/lib/local-preparation-store.ts",
    "    priority: input.priority || 'medium',\n    notes: input.notes || null,\n",
    "    priority: input.priority || 'medium',\n    selection_notes: input.selection_notes || null,\n    notes: input.notes || null,\n",
)

# 3. Normalize arrays after online loading and backup imports.
replace_once(
    "src/components/OnlinePreparationWorkspace.tsx",
    "          subject_tags: Array.isArray(journal.subject_tags) ? journal.subject_tags : [],\n          indexing: Array.isArray(journal.indexing) ? journal.indexing : [],\n",
    "          subject_tags: Array.isArray(journal.subject_tags) ? journal.subject_tags : [],\n          selection_tags: Array.isArray(journal.selection_tags) ? journal.selection_tags : [],\n          indexing: Array.isArray(journal.indexing) ? journal.indexing : [],\n",
)
replace_once(
    "src/lib/preparation-backup.ts",
    "    subject_tags: Array.isArray(source.subject_tags) ? source.subject_tags : [],\n    indexing: Array.isArray(source.indexing) ? source.indexing : [],\n",
    "    subject_tags: Array.isArray(source.subject_tags) ? source.subject_tags : [],\n    selection_tags: Array.isArray(source.selection_tags) ? source.selection_tags : [],\n    indexing: Array.isArray(source.indexing) ? source.indexing : [],\n",
)

# 4. Crossref DOI metadata may expose the official abbreviated journal title.
replace_once(
    "src/lib/journal-lookup.ts",
    "  name?: string\n  publisher?: string\n",
    "  name?: string\n  officialAbbreviation?: string\n  publisher?: string\n",
)
replace_once(
    "src/lib/journal-lookup.ts",
    "    name: journal?.name || (typeof container === 'string' ? container : typeof shortContainer === 'string' ? shortContainer : undefined),\n    publisher: journal?.publisher || (typeof message.publisher === 'string' ? message.publisher : undefined),\n",
    "    name: journal?.name || (typeof container === 'string' ? container : typeof shortContainer === 'string' ? shortContainer : undefined),\n    officialAbbreviation: typeof shortContainer === 'string' && shortContainer.trim() ? shortContainer.trim() : undefined,\n    publisher: journal?.publisher || (typeof message.publisher === 'string' ? message.publisher : undefined),\n",
)
replace_once(
    "src/lib/journal-lookup.ts",
    "    note: '已从 DOI 识别所属期刊及基础出版信息。请核对期刊官网，并手动确认分区、APC 和审稿周期。',\n",
    "    note: '已从 DOI 识别所属期刊、官方缩写及基础出版信息。中文译名和简介翻译请人工核对后保存。',\n",
)

# 5. Journal editor: translated identity, translated scope, selection tags and selection notes.
replace_once(
    "src/components/JournalFormEnhanced.tsx",
    "  const [name, setName] = useState(source?.name || '')\n  const [publisher, setPublisher] = useState(source?.publisher || '')\n",
    "  const [name, setName] = useState(source?.name || '')\n  const [nameZh, setNameZh] = useState(source?.name_zh || '')\n  const [officialAbbreviation, setOfficialAbbreviation] = useState(source?.official_abbreviation || '')\n  const [publisher, setPublisher] = useState(source?.publisher || '')\n",
)
replace_once(
    "src/components/JournalFormEnhanced.tsx",
    "  const [scope, setScope] = useState(source?.scope || '')\n  const [tags, setTags] = useState(fromList(source?.subject_tags))\n  const [indexing, setIndexing] = useState<string[]>(source?.indexing || [])\n",
    "  const [scope, setScope] = useState(source?.scope || '')\n  const [scopeZh, setScopeZh] = useState(source?.scope_zh || '')\n  const [tags, setTags] = useState(fromList(source?.subject_tags))\n  const [selectionTags, setSelectionTags] = useState(fromList(source?.selection_tags))\n  const [indexing, setIndexing] = useState<string[]>(source?.indexing || [])\n",
)
replace_once(
    "src/components/JournalFormEnhanced.tsx",
    "  const [priority, setPriority] = useState<string>(source?.priority || 'medium')\n  const [notes, setNotes] = useState(source?.notes || '')\n",
    "  const [priority, setPriority] = useState<string>(source?.priority || 'medium')\n  const [selectionNotes, setSelectionNotes] = useState(source?.selection_notes || '')\n  const [notes, setNotes] = useState(source?.notes || '')\n",
)
replace_once(
    "src/components/JournalFormEnhanced.tsx",
    "      if (result.name) setName(result.name)\n      if (result.publisher) setPublisher(result.publisher)\n",
    "      if (result.name) setName(result.name)\n      if (result.officialAbbreviation) setOfficialAbbreviation(result.officialAbbreviation)\n      if (result.publisher) setPublisher(result.publisher)\n",
)
replace_once(
    "src/components/JournalFormEnhanced.tsx",
    "        ...(source || {}), name: name.trim(), publisher: publisher.trim() || null,\n        website_url: website.trim() || null, author_guide_url: guide.trim() || null,\n",
    "        ...(source || {}), name: name.trim(), name_zh: nameZh.trim() || null,\n        official_abbreviation: officialAbbreviation.trim() || null, publisher: publisher.trim() || null,\n        website_url: website.trim() || null, author_guide_url: guide.trim() || null,\n",
)
replace_once(
    "src/components/JournalFormEnhanced.tsx",
    "        issn: issn.trim() || null, eissn: eissn.trim() || null, scope: scope.trim() || null,\n        subject_tags: toList(tags), indexing, jcr_quartile: jcr.trim() || null, cas_quartile: cas.trim() || null,\n",
    "        issn: issn.trim() || null, eissn: eissn.trim() || null, scope: scope.trim() || null,\n        scope_zh: scopeZh.trim() || null, subject_tags: toList(tags), selection_tags: toList(selectionTags),\n        indexing, jcr_quartile: jcr.trim() || null, cas_quartile: cas.trim() || null,\n",
)
replace_once(
    "src/components/JournalFormEnhanced.tsx",
    "        risk_level: risk as JournalProfile['risk_level'], is_favorite: favorite,\n        priority: priority as JournalProfile['priority'], notes: notes.trim() || null,\n",
    "        risk_level: risk as JournalProfile['risk_level'], is_favorite: favorite,\n        priority: priority as JournalProfile['priority'], selection_notes: selectionNotes.trim() || null,\n        notes: notes.trim() || null,\n",
)
old_identity = """        <section className=\"journal-form-section identity\"><div className=\"journal-form-section-head\"><b>基础身份</b><span>DOI / ISSN 可自动填充</span></div>
          <div className=\"prep-form-grid two\"><Field label=\"期刊名称\" wide><input className=\"input\" value={name} onChange={event => setName(event.target.value)} autoFocus={!source} maxLength={200} /></Field><Field label=\"出版社\"><input className=\"input\" value={publisher} onChange={event => setPublisher(event.target.value)} /></Field><Field label=\"收藏优先级\"><select className=\"select\" value={priority} onChange={event => setPriority(event.target.value)}>{PRIORITY_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field></div>
          <div className=\"prep-form-grid four\"><Field label=\"ISSN\"><input className=\"input\" value={issn} onChange={event => setIssn(event.target.value)} /></Field><Field label=\"EISSN\"><input className=\"input\" value={eissn} onChange={event => setEissn(event.target.value)} /></Field><Field label=\"JCR 分区\"><input className=\"input\" value={jcr} onChange={event => setJcr(event.target.value)} placeholder=\"Q1\" /></Field><Field label=\"中科院分区\"><input className=\"input\" value={cas} onChange={event => setCas(event.target.value)} placeholder=\"一区\" /></Field></div>
        </section>"""
new_identity = """        <section className=\"journal-form-section identity journal-identity-localized\"><div className=\"journal-form-section-head\"><b>基础身份</b><span>英文名与官方缩写可由 DOI 识别；中文信息需人工核对</span></div>
          <div className=\"prep-form-grid two\"><Field label=\"英文期刊名\" wide><input className=\"input\" value={name} onChange={event => setName(event.target.value)} autoFocus={!source} maxLength={200} /></Field><Field label=\"中文译名\"><input className=\"input\" value={nameZh} onChange={event => setNameZh(event.target.value)} maxLength={200} placeholder=\"用于中文检索与快速辨认\" /></Field><Field label=\"官方缩写\"><input className=\"input\" value={officialAbbreviation} onChange={event => setOfficialAbbreviation(event.target.value)} maxLength={80} placeholder=\"以期刊官网或数据库为准\" /></Field></div>
          <div className=\"prep-form-grid three\"><Field label=\"出版社\"><input className=\"input\" value={publisher} onChange={event => setPublisher(event.target.value)} /></Field><Field label=\"收藏优先级\"><select className=\"select\" value={priority} onChange={event => setPriority(event.target.value)}>{PRIORITY_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field><Field label=\"选刊标签\"><input className=\"input\" value={selectionTags} onChange={event => setSelectionTags(event.target.value)} placeholder=\"主投, 备选, 审稿快, 岩土工程\" /></Field></div>
          <div className=\"prep-form-grid four\"><Field label=\"ISSN\"><input className=\"input\" value={issn} onChange={event => setIssn(event.target.value)} /></Field><Field label=\"EISSN\"><input className=\"input\" value={eissn} onChange={event => setEissn(event.target.value)} /></Field><Field label=\"JCR 分区\"><input className=\"input\" value={jcr} onChange={event => setJcr(event.target.value)} placeholder=\"Q1\" /></Field><Field label=\"中科院分区\"><input className=\"input\" value={cas} onChange={event => setCas(event.target.value)} placeholder=\"一区\" /></Field></div>
        </section>"""
replace_once("src/components/JournalFormEnhanced.tsx", old_identity, new_identity)

old_notes = """        <section className=\"journal-form-section notes\"><div className=\"journal-form-section-head\"><b>适配与备注</b><span>记录为什么投、为什么不投</span></div>
          <div className=\"prep-form-grid two\"><Field label=\"研究领域标签\"><input className=\"input\" value={tags} onChange={event => setTags(event.target.value)} placeholder=\"地质灾害, 滑坡, 遥感\" /></Field><Field label=\"风险状态\"><select className=\"select\" value={risk} onChange={event => setRisk(event.target.value)}><option value=\"normal\">正常</option><option value=\"watch\">关注</option><option value=\"warning\">预警 / 谨慎</option></select></Field></div>
          <Field label=\"期刊范围与适配说明\" wide><textarea className=\"textarea\" value={scope} onChange={event => setScope(event.target.value)} /></Field>
          <Field label=\"第三方介绍与数据来源\" wide><textarea className=\"textarea\" value={thirdParty} onChange={event => setThirdParty(event.target.value)} placeholder={'每行：LetPub|https://...\\nCrossref|https://...'} /></Field>
          <div className=\"prep-form-grid two\"><Field label=\"费用与开放获取备注\"><textarea className=\"textarea\" value={feeNotes} onChange={event => setFeeNotes(event.target.value)} /></Field><Field label=\"其它备注\"><textarea className=\"textarea\" value={notes} onChange={event => setNotes(event.target.value)} /></Field></div>
          <label className=\"prep-switch\"><input type=\"checkbox\" checked={favorite} onChange={event => setFavorite(event.target.checked)} /><span>加入收藏期刊</span></label>
        </section>"""
new_notes = """        <section className=\"journal-form-section notes selection-profile\"><div className=\"journal-form-section-head\"><b>选刊信息与简介</b><span>保留原文、中文翻译与个人判断，便于检索和横向比较</span></div>
          <div className=\"prep-form-grid two\"><Field label=\"研究领域标签\"><input className=\"input\" value={tags} onChange={event => setTags(event.target.value)} placeholder=\"地质灾害, 滑坡, 岩土工程, 遥感\" /></Field><Field label=\"风险状态\"><select className=\"select\" value={risk} onChange={event => setRisk(event.target.value)}><option value=\"normal\">正常</option><option value=\"watch\">关注</option><option value=\"warning\">预警 / 谨慎</option></select></Field></div>
          <Field label=\"英文期刊简介 / Aims & Scope\" wide><textarea className=\"textarea journal-scope-source\" value={scope} onChange={event => setScope(event.target.value)} placeholder=\"粘贴官网 Aims & Scope 或自行概括\" /></Field>
          <Field label=\"中文简介翻译\" wide><textarea className=\"textarea journal-scope-translation\" value={scopeZh} onChange={event => setScopeZh(event.target.value)} placeholder=\"概括收稿范围、偏好方法、常见研究对象及不适合方向\" /></Field>
          <Field label=\"选刊备注\" wide><textarea className=\"textarea journal-selection-notes\" value={selectionNotes} onChange={event => setSelectionNotes(event.target.value)} placeholder=\"例如：主投；偏工程地质；接收机器学习但需机理讨论；不适合纯遥感分类\" /></Field>
          <Field label=\"第三方介绍与数据来源\" wide><textarea className=\"textarea\" value={thirdParty} onChange={event => setThirdParty(event.target.value)} placeholder={'每行：LetPub|https://...\\nCrossref|https://...'} /></Field>
          <div className=\"prep-form-grid two\"><Field label=\"费用与开放获取备注\"><textarea className=\"textarea\" value={feeNotes} onChange={event => setFeeNotes(event.target.value)} /></Field><Field label=\"其它备注\"><textarea className=\"textarea\" value={notes} onChange={event => setNotes(event.target.value)} /></Field></div>
          <label className=\"prep-switch\"><input type=\"checkbox\" checked={favorite} onChange={event => setFavorite(event.target.checked)} /><span>加入收藏期刊</span></label>
        </section>"""
replace_once("src/components/JournalFormEnhanced.tsx", old_notes, new_notes)

# 6. Search and compact journal cards surface translated identity and personal tags.
replace_once(
    "src/components/PreparationWorkspace.tsx",
    "      subject_tags: Array.isArray(journal.subject_tags) ? journal.subject_tags : [],\n      indexing: Array.isArray(journal.indexing) ? journal.indexing : [],\n",
    "      subject_tags: Array.isArray(journal.subject_tags) ? journal.subject_tags : [],\n      selection_tags: Array.isArray(journal.selection_tags) ? journal.selection_tags : [],\n      indexing: Array.isArray(journal.indexing) ? journal.indexing : [],\n",
)
replace_once(
    "src/components/PreparationWorkspace.tsx",
    "    () => normalized.journals.filter(item => !query || `${item.name} ${item.publisher || ''} ${item.scope || ''} ${item.subject_tags.join(' ')}`.toLocaleLowerCase().includes(query)),\n",
    "    () => normalized.journals.filter(item => !query || `${item.name} ${item.name_zh || ''} ${item.official_abbreviation || ''} ${item.publisher || ''} ${item.scope || ''} ${item.scope_zh || ''} ${item.subject_tags.join(' ')} ${item.selection_tags.join(' ')} ${item.selection_notes || ''} ${item.notes || ''}`.toLocaleLowerCase().includes(query)),\n",
)
replace_once(
    "src/components/PreparationWorkspace.tsx",
    "        <span><b>{journal.name}</b><small>{journal.publisher || journal.scope || '未填写出版社或范围'}</small></span>\n",
    "        <span><b>{journal.name}</b><small>{[journal.name_zh, journal.official_abbreviation, journal.publisher || journal.scope_zh || journal.scope].filter(Boolean).join(' · ') || '未填写中文名、缩写或出版社'}</small></span>\n",
)
replace_once(
    "src/components/PreparationWorkspace.tsx",
    "function JournalCard({ journal, onClick }: { journal: JournalProfile; onClick: () => void }) {\n  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'\n  return <article className=\"prep-journal-card\">\n    <button className=\"prep-journal-card-main\" onClick={onClick}>\n",
    "function JournalCard({ journal, onClick }: { journal: JournalProfile; onClick: () => void }) {\n  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'\n  const identityLine = [journal.name_zh, journal.official_abbreviation, journal.publisher].filter(Boolean).join(' · ') || journal.scope_zh || journal.scope || '尚未填写中文名、缩写或出版社'\n  return <article className=\"prep-journal-card\">\n    <button className=\"prep-journal-card-main\" onClick={onClick} title={journal.selection_notes || journal.scope_zh || undefined}>\n",
)
replace_once(
    "src/components/PreparationWorkspace.tsx",
    "      <h3>{journal.name}</h3>\n      <p>{journal.publisher || journal.scope || '尚未填写出版社与期刊范围'}</p>\n",
    "      <h3>{journal.name}</h3>\n      <p title={identityLine}>{identityLine}</p>\n",
)
replace_once(
    "src/components/PreparationWorkspace.tsx",
    "      <div className=\"prep-journal-facts\">\n        <span data-tone=\"oa\">{oa}</span>\n",
    "      <div className=\"prep-journal-facts\">\n        {journal.selection_tags.slice(0, 2).map(item => <span key={`selection-${item}`} data-tone=\"selection\">{item}</span>)}\n        <span data-tone=\"oa\">{oa}</span>\n",
)

# 7. Journal comparison includes translated and personal selection information.
replace_once(
    "src/components/JournalComparison.tsx",
    "const rows: Row[] = [\n  { label: '主要分区 / 核心收录', value: journal => journalPrimarySummary(journal as RankedJournalProfile, 5) },\n",
    "const rows: Row[] = [\n  { label: '中文译名', value: journal => journal.name_zh || '未记录' },\n  { label: '官方缩写', value: journal => journal.official_abbreviation || '未记录' },\n  { label: '主要分区 / 核心收录', value: journal => journalPrimarySummary(journal as RankedJournalProfile, 5) },\n",
)
replace_once(
    "src/components/JournalComparison.tsx",
    "  { label: '学科标签', value: journal => journal.subject_tags.length ? journal.subject_tags.join('、') : '未记录' },\n  { label: '期刊范围', value: journal => journal.scope || '未记录' },\n",
    "  { label: '学科标签', value: journal => journal.subject_tags.length ? journal.subject_tags.join('、') : '未记录' },\n  { label: '选刊标签', value: journal => journal.selection_tags.length ? journal.selection_tags.join('、') : '未记录' },\n  { label: '英文期刊简介', value: journal => journal.scope || '未记录' },\n  { label: '中文简介翻译', value: journal => journal.scope_zh || '未记录' },\n  { label: '选刊备注', value: journal => journal.selection_notes || '未记录' },\n",
)
replace_once(
    "src/components/JournalComparison.tsx",
    "      {journals.map(journal => <label key={journal.id} className={selectedIds.includes(journal.id) ? 'selected' : ''}><input type=\"checkbox\" checked={selectedIds.includes(journal.id)} onChange={() => toggle(journal.id)} /><span>{journal.name}</span><em>{journalPrimarySummary(journal as RankedJournalProfile, 3)}</em></label>)}\n",
    "      {journals.map(journal => <label key={journal.id} className={selectedIds.includes(journal.id) ? 'selected' : ''}><input type=\"checkbox\" checked={selectedIds.includes(journal.id)} onChange={() => toggle(journal.id)} /><span>{journal.name}</span><em>{[journal.official_abbreviation, journal.name_zh, journalPrimarySummary(journal as RankedJournalProfile, 3)].filter(Boolean).join(' · ')}</em></label>)}\n",
)
replace_once(
    "src/components/JournalComparison.tsx",
    "      <thead><tr><th>比较项目</th>{selected.map(journal => <th key={journal.id}><div><button onClick={() => onEdit(journal)}>{journal.name}</button><button className=\"compare-remove\" onClick={() => toggle(journal.id)} title=\"移出比较\"><X size={12} /></button></div><small>{journal.publisher || '未记录出版社'}</small><div className=\"compare-links\">",
    "      <thead><tr><th>比较项目</th>{selected.map(journal => <th key={journal.id}><div><button onClick={() => onEdit(journal)}>{journal.name}</button><button className=\"compare-remove\" onClick={() => toggle(journal.id)} title=\"移出比较\"><X size={12} /></button></div><small>{[journal.name_zh, journal.official_abbreviation, journal.publisher].filter(Boolean).join(' · ') || '未记录中文名、缩写或出版社'}</small><div className=\"compare-links\">",
)

# 8. Styling shared by both Luminous interfaces.
write(
    "src/journal-selection-metadata.css",
    """/* Journal selection metadata shared by Luminous and Luminous X. */

.preparation-workspace[data-section='journals'] .prep-journal-facts > span[data-tone='selection'] {
  border-color: rgba(124, 58, 237, .16) !important;
  background: rgba(124, 58, 237, .075) !important;
  color: #6d28d9 !important;
  font-weight: 760 !important;
}

html[data-theme='dark'] .preparation-workspace[data-section='journals'] .prep-journal-facts > span[data-tone='selection'] {
  border-color: rgba(196, 181, 253, .2) !important;
  background: rgba(139, 92, 246, .12) !important;
  color: #c4b5fd !important;
}

.journal-form-modal .journal-identity-localized .prep-form-grid,
.journal-form-modal .selection-profile .prep-form-grid {
  align-items: start;
}

.journal-form-modal .selection-profile .journal-scope-source,
.journal-form-modal .selection-profile .journal-scope-translation {
  min-height: 88px !important;
}

.journal-form-modal .selection-profile .journal-selection-notes {
  min-height: 72px !important;
}

.journal-compare-table td {
  max-width: 300px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.journal-compare-picker label em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .journal-form-modal .selection-profile .journal-scope-source,
  .journal-form-modal .selection-profile .journal-scope-translation,
  .journal-form-modal .selection-profile .journal-selection-notes {
    min-height: 76px !important;
  }
}
""",
)
replace_once(
    "src/app-styles.ts",
    "import './journal-library-regression-fixes.css'\n",
    "import './journal-library-regression-fixes.css'\nimport './journal-selection-metadata.css'\n",
)

# 9. Database migration with user-owned columns and tag index.
write(
    "supabase/011_journal_selection_metadata.sql",
    """-- Submission Hub — Migration 011: journal selection metadata

ALTER TABLE public.journal_profiles
  ADD COLUMN IF NOT EXISTS name_zh TEXT,
  ADD COLUMN IF NOT EXISTS official_abbreviation TEXT,
  ADD COLUMN IF NOT EXISTS scope_zh TEXT,
  ADD COLUMN IF NOT EXISTS selection_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selection_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_journal_profiles_selection_tags
  ON public.journal_profiles USING GIN(selection_tags);

COMMENT ON COLUMN public.journal_profiles.name_zh IS 'User-verified Chinese journal name translation.';
COMMENT ON COLUMN public.journal_profiles.official_abbreviation IS 'Official journal abbreviation from the publisher or bibliographic database.';
COMMENT ON COLUMN public.journal_profiles.scope_zh IS 'User-verified Chinese translation or summary of the journal aims and scope.';
COMMENT ON COLUMN public.journal_profiles.selection_tags IS 'Personal journal-selection tags such as primary target, backup, fast review, or method preference.';
COMMENT ON COLUMN public.journal_profiles.selection_notes IS 'Personal fit assessment and journal-selection notes.';
""",
)

# 10. Focused regression check and visual field assertions.
write(
    "scripts/check-journal-selection-metadata.mjs",
    """import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const checks = [
  ['src/lib/preparation.ts', ['name_zh:', 'official_abbreviation:', 'scope_zh:', 'selection_tags:', 'selection_notes:']],
  ['src/components/JournalFormEnhanced.tsx', ['中文译名', '官方缩写', '中文简介翻译', '选刊标签', '选刊备注']],
  ['src/components/PreparationWorkspace.tsx', ['item.name_zh', 'item.official_abbreviation', 'item.scope_zh', 'item.selection_tags', 'item.selection_notes']],
  ['src/components/JournalComparison.tsx', ["label: '中文译名'", "label: '官方缩写'", "label: '中文简介翻译'", "label: '选刊标签'", "label: '选刊备注'"]],
  ['supabase/011_journal_selection_metadata.sql', ['ADD COLUMN IF NOT EXISTS name_zh', 'ADD COLUMN IF NOT EXISTS official_abbreviation', 'ADD COLUMN IF NOT EXISTS scope_zh', 'ADD COLUMN IF NOT EXISTS selection_tags', 'ADD COLUMN IF NOT EXISTS selection_notes']],
]

const failures = []
for (const [path, tokens] of checks) {
  const source = read(path)
  for (const token of tokens) if (!source.includes(token)) failures.push(`${path}: missing ${token}`)
}
if (failures.length) throw new Error(failures.join(' | '))
console.log('Journal selection metadata contract verified.')
""",
)

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["scripts"]["check:journal-selection"] = "node scripts/check-journal-selection-metadata.mjs"
package["scripts"]["verify"] = "npm run check:privacy && npm run check:journal-selection && npm run build && npm run build:offline && npm run check:offline"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

replace_once(
    "tests/visual/journal-library-density-check.mjs",
    "    const apcLabel = await modal.locator('.prep-field > span').evaluateAll(nodes => nodes.map(node => node.textContent?.trim()).find(text => text === 'APC') || '')\n    if (apcLabel !== 'APC') failures.push(`${ui}/form: APC field label was not normalized`)\n\n",
    "    const fieldLabels = await modal.locator('.prep-field > span').allTextContents()\n    const apcLabel = fieldLabels.map(text => text.trim()).find(text => text === 'APC') || ''\n    if (apcLabel !== 'APC') failures.push(`${ui}/form: APC field label was not normalized`)\n    for (const label of ['中文译名', '官方缩写', '中文简介翻译', '选刊标签', '选刊备注']) {\n      if (!fieldLabels.some(text => text.trim() === label)) failures.push(`${ui}/form: missing journal selection field ${label}`)\n    }\n\n",
)

# Remove the one-shot automation after it has applied the patch.
for transient in [
    ROOT / "scripts/apply-journal-selection-metadata.py",
    ROOT / ".github/workflows/apply-journal-selection-metadata.yml",
]:
    if transient.exists():
        transient.unlink()

print("Journal selection metadata patch applied.")
