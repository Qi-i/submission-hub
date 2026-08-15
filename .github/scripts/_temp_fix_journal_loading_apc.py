from pathlib import Path


def require_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)


# 1) Keep existing workspace visible after saves/deletes; only initial load shows blocking loader.
online = Path('src/components/OnlinePreparationWorkspace.tsx')
text = online.read_text(encoding='utf-8')
text = require_replace(
    text,
    "  const load = useCallback(async () => {\n    const version = ++loadVersion.current\n    setLoading(true)\n",
    "  const load = useCallback(async (showLoading = true) => {\n    const version = ++loadVersion.current\n    if (showLoading) setLoading(true)\n",
    'online load signature',
)
text = require_replace(
    text,
    "      if (version === loadVersion.current) setLoading(false)\n",
    "      if (version === loadVersion.current && showLoading) setLoading(false)\n",
    'online load finally',
)
reload_count = text.count('    await load()\n')
if reload_count < 6:
    raise SystemExit(f'Expected at least 6 mutation reloads, found {reload_count}')
text = text.replace('    await load()\n', '    await load(false)\n')
online.write_text(text, encoding='utf-8')


# 2) Use a dedicated loading indicator and declarative APC->CNY rendering.
workspace = Path('src/components/PreparationWorkspace.tsx')
text = workspace.read_text(encoding='utf-8')
text = require_replace(
    text,
    "  FilePenLine, LayoutDashboard, Lightbulb, Plus, Scale, Search, Star, Target,\n",
    "  FilePenLine, LayoutDashboard, Lightbulb, LoaderCircle, Plus, Scale, Search, Star, Target,\n",
    'LoaderCircle import',
)
text = require_replace(
    text,
    "import JournalComparison from './JournalComparison'\n",
    "import CurrencyCny from './CurrencyCny'\nimport JournalComparison from './JournalComparison'\n",
    'CurrencyCny import',
)
text = require_replace(
    text,
    '  if (loading) return <div className="prep-loading"><div className="spinner" /> 加载投稿准备数据...</div>\n',
    '''  if (loading) return <div className="prep-loading" role="status" aria-live="polite">\n    <div className="prep-loading-shell">\n      <LoaderCircle className="prep-loading-icon" size={22} aria-hidden="true" />\n      <div className="prep-loading-copy"><strong>正在加载投稿准备数据</strong><span>同步期刊、选题与草稿…</span></div>\n    </div>\n  </div>\n''',
    'loading markup',
)
text = require_replace(
    text,
    '      <span data-tone="fit">{journalFitSummary(journal)}</span>\n',
    '''      <span data-tone="fit">{journalFitSummary(journal)}{journal.apc_amount != null && journal.apc_amount > 0 && !['CNY', 'RMB', 'CNH'].includes((journal.apc_currency || '').trim().toUpperCase()) && <CurrencyCny amount={journal.apc_amount} currency={journal.apc_currency || 'USD'} showOriginal={false} compact className="prep-overview-apc-cny" />}</span>\n''',
    'overview APC CNY',
)
text = require_replace(
    text,
    "        <div><b>{journal.apc_amount != null ? journal.apc_amount : '—'}</b><small>{journal.apc_currency || 'APC'}</small></div>\n",
    '''        <div className="prep-journal-apc-metric"><b>{journal.apc_amount != null ? journal.apc_amount : '—'}</b><small>{journal.apc_currency || 'APC'}</small>{journal.apc_amount != null && journal.apc_amount > 0 && !['CNY', 'RMB', 'CNH'].includes((journal.apc_currency || '').trim().toUpperCase()) && <CurrencyCny amount={journal.apc_amount} currency={journal.apc_currency || 'USD'} showOriginal={false} compact className="prep-journal-apc-cny" />}</div>\n''',
    'journal APC metric',
)
workspace.write_text(text, encoding='utf-8')


# 3) Preserve DOM enhancer for compacting/forms, but stop it from duplicating React CNY output.
enhancer = Path('src/components/ApcAutoConverter.tsx')
text = enhancer.read_text(encoding='utf-8')
text = require_replace(
    text,
    "    const feeCell = card.querySelector<HTMLElement>('[data-metric=\"apc\"]')\n    const amountNode = feeCell?.querySelector<HTMLElement>('b')\n",
    "    const feeCell = card.querySelector<HTMLElement>('[data-metric=\"apc\"]')\n    if (feeCell?.querySelector('.prep-journal-apc-cny')) return\n    const amountNode = feeCell?.querySelector<HTMLElement>('b')\n",
    'APC enhancer card guard',
)
text = require_replace(
    text,
    "  document.querySelectorAll<HTMLElement>('.prep-journal-overview-card').forEach(card => {\n    const fit = card.querySelector<HTMLElement>('.prep-overview-journal-meta [data-tone=\"fit\"]')\n",
    "  document.querySelectorAll<HTMLElement>('.prep-journal-overview-card').forEach(card => {\n    if (card.querySelector('.prep-overview-apc-cny')) return\n    const fit = card.querySelector<HTMLElement>('.prep-overview-journal-meta [data-tone=\"fit\"]')\n",
    'APC enhancer overview guard',
)
enhancer.write_text(text, encoding='utf-8')


# 4) Final CSS layer, shared by Luminous and Luminous X.
style = Path('src/journal-center-loading-apc-polish.css')
style.write_text('''/* Final journal-center loading and APC currency contract. */
.prep-loading {
  min-height: clamp(190px, 34vh, 320px) !important;
  display: grid !important;
  place-items: center !important;
  padding: 28px !important;
  color: var(--text-secondary);
}

.prep-loading-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: min(330px, calc(100vw - 48px));
  padding: 13px 16px;
  border: 1px solid color-mix(in srgb, var(--border-subtle) 88%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-card) 96%, transparent);
  box-shadow: 0 10px 30px rgba(15, 23, 42, .08);
  backdrop-filter: blur(10px);
}

.prep-loading-icon {
  flex: 0 0 auto;
  color: var(--accent);
  animation: prep-loading-spin .78s linear infinite;
}

.prep-loading-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.prep-loading-copy strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 760;
  line-height: 1.35;
}

.prep-loading-copy span {
  color: var(--text-muted);
  font-size: 10.5px;
  line-height: 1.35;
}

@keyframes prep-loading-spin {
  to { transform: rotate(360deg); }
}

.prep-journal-apc-cny {
  width: 100%;
  display: flex !important;
  justify-content: center;
  margin-top: 2px;
  font-size: 9px;
  line-height: 1.15;
  white-space: nowrap;
}

.prep-journal-apc-cny .currency-estimate,
.prep-overview-apc-cny .currency-estimate {
  color: #047857;
  font-weight: 760;
}

.prep-journal-apc-cny .currency-loading,
.prep-journal-apc-cny .currency-unavailable {
  font-size: 8.5px;
  white-space: normal;
}

.prep-journal-facts .prep-journal-apc-metric .prep-journal-apc-cny,
.prep-journal-facts .prep-journal-apc-metric .prep-journal-apc-cny span {
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}

.prep-journal-facts .prep-journal-apc-metric .prep-journal-apc-cny {
  width: auto;
  display: inline-flex !important;
  margin: 0 0 0 5px;
  vertical-align: middle;
}

.prep-overview-apc-cny {
  display: inline-flex !important;
  align-items: center;
  margin-left: 6px;
  padding-left: 6px;
  border-left: 1px solid rgba(5, 150, 105, .22);
  font-size: 9.5px;
  line-height: 1.2;
  white-space: nowrap;
}

.prep-overview-journal-meta [data-tone='fit'] .prep-overview-apc-cny,
.prep-overview-journal-meta [data-tone='fit'] .prep-overview-apc-cny span {
  border-top: 0;
  border-right: 0;
  border-bottom: 0;
  border-radius: 0;
  background: transparent;
}

html[data-theme='dark'] .prep-loading-shell {
  box-shadow: 0 12px 34px rgba(0, 0, 0, .18);
}

html[data-theme='dark'] .prep-journal-apc-cny .currency-estimate,
html[data-theme='dark'] .prep-overview-apc-cny .currency-estimate {
  color: #6ee7b7;
}

@media (max-width: 720px) {
  .prep-loading {
    padding: 18px !important;
  }

  .prep-loading-shell {
    min-width: 0;
    width: 100%;
    max-width: 340px;
  }

  .prep-overview-apc-cny {
    flex-basis: 100%;
    margin: 3px 0 0;
    padding: 0;
    border-left: 0;
  }
}
''', encoding='utf-8')

app_styles = Path('src/app-styles.ts')
text = app_styles.read_text(encoding='utf-8')
import_line = "import './journal-center-loading-apc-polish.css'\n"
if import_line not in text:
    text = text.rstrip() + '\n' + import_line
app_styles.write_text(text, encoding='utf-8')


# 5) Extend existing Journal Center regression test.
test = Path('tests/visual/journal-center-header-filter-check.mjs')
text = test.read_text(encoding='utf-8')
if "from 'node:fs'" not in text:
    text = require_replace(
        text,
        "import { chromium } from 'playwright'\n",
        "import { readFileSync } from 'node:fs'\nimport { chromium } from 'playwright'\n",
        'visual test fs import',
    )
static_marker = "const fail = message => failures.push(message)\n"
static_checks = '''\nconst preparationSource = readFileSync(new URL('../../src/components/PreparationWorkspace.tsx', import.meta.url), 'utf8')\nconst onlinePreparationSource = readFileSync(new URL('../../src/components/OnlinePreparationWorkspace.tsx', import.meta.url), 'utf8')\nif (preparationSource.includes('className=\"spinner\"')) fail('投稿准备加载态仍复用全局 spinner 类')\nif (!preparationSource.includes('prep-loading-icon')) fail('投稿准备缺少独立加载图标契约')\nif (!preparationSource.includes('prep-journal-apc-cny') || !preparationSource.includes('prep-overview-apc-cny')) fail('期刊 APC 人民币参考价未由 React 直接渲染')\nif ((onlinePreparationSource.match(/await load\\(false\\)/g) || []).length < 6) fail('保存/删除后仍会触发全屏投稿准备 loading')\n'''
if static_checks not in text:
    text = require_replace(text, static_marker, static_marker + static_checks, 'static loading/APC checks')
placement_marker = "    if (placement.overflow > 2) fail(`${ui}: 顶部筛选溢出 ${placement.overflow}px`)\n"
apc_checks = '''\n    const apc = await page.evaluate(() => {\n      const cards = Array.from(document.querySelectorAll('.preparation-workspace[data-section=\"journals\"] .prep-journal-card'))\n      const priced = cards.filter(card => {\n        const cell = card.querySelector('.prep-journal-apc-metric')\n        const value = cell?.querySelector('b')?.textContent?.trim() || ''\n        return value && value !== '—' && value !== '--'\n      })\n      return {\n        priced: priced.length,\n        declarativeCny: priced.filter(card => !!card.querySelector('.prep-journal-apc-cny')).length,\n        legacyInjected: document.querySelectorAll('.prep-journal-card .journal-card-cny').length,\n      }\n    })\n    if (apc.priced > 0 && apc.declarativeCny !== apc.priced) fail(`${ui}: 有 ${apc.priced} 个 APC 金额，但仅 ${apc.declarativeCny} 个直接渲染人民币参考价`)\n    if (apc.legacyInjected > 0) fail(`${ui}: 仍由后置 DOM 增强器注入 ${apc.legacyInjected} 个 APC 人民币节点`)\n'''
if apc_checks not in text:
    text = require_replace(text, placement_marker, placement_marker + apc_checks, 'visual APC checks')
test.write_text(text, encoding='utf-8')

print('PATCH_OK')
