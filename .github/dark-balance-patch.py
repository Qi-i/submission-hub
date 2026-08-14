from pathlib import Path

p = Path('src/ui-geometry-contract.css')
s = p.read_text(encoding='utf-8')
s = s.replace("""html[data-theme='dark'][data-ui] {
  --text-primary: #eef4f9;
  --text-secondary: #bcc7d3;
  --text-muted: #8e9cac;
  --text-tertiary: #7f8d9d;
  --bg-page: #1e2630;
  --bg-card: rgba(39, 51, 64, .92);
  --bg-elevated: rgba(48, 62, 77, .90);
  --border-default: rgba(183, 199, 216, .19);
  --border-subtle: rgba(183, 199, 216, .12);
  --space-glass-border: rgba(183, 199, 216, .16);
  --space-glass-highlight: rgba(238, 244, 249, .055);
  --space-glass-shadow: 0 14px 34px rgba(4, 10, 16, .18);
  color-scheme: dark;
}""", """html[data-theme='dark'][data-ui] {
  --text-primary: #f1f5f9;
  --text-secondary: #c2ced9;
  --text-muted: #93a2b1;
  --text-tertiary: #8291a1;
  --bg-base: #1b242d;
  --bg-page: #1b242d;
  --bg-card: rgba(37, 49, 60, .95);
  --bg-elevated: rgba(45, 59, 72, .94);
  --border-default: rgba(184, 202, 218, .20);
  --border-subtle: rgba(184, 202, 218, .13);
  --space-glass-border: rgba(184, 202, 218, .17);
  --space-glass-highlight: rgba(241, 245, 249, .052);
  --space-glass-shadow: 0 12px 30px rgba(5, 10, 15, .20);
  color-scheme: dark;
}""")
s = s.replace("""html[data-theme='dark'][data-ui] body {
  color: #e8eef5 !important;
  background-color: #1e2630 !important;
  background-image:
    radial-gradient(ellipse at 10% 4%, rgba(82, 145, 177, .075), transparent 42%),
    radial-gradient(ellipse at 88% 16%, rgba(139, 116, 177, .055), transparent 44%),
    radial-gradient(ellipse at 52% 94%, rgba(79, 139, 133, .035), transparent 48%),
    linear-gradient(135deg, #1e2630 0%, #222c36 52%, #1c242d 100%) !important;
}""", """html[data-theme='dark'][data-ui] body {
  color: #edf3f8 !important;
  background-color: #1b242d !important;
  background-image: linear-gradient(180deg, #1b242d 0%, #1f2a34 54%, #19222b 100%) !important;
  animation: none !important;
}""")
s = s.replace("""  background: linear-gradient(145deg, rgba(42, 54, 68, .94), rgba(34, 45, 57, .91)) !important;
  border-color: rgba(183, 199, 216, .17) !important;
  box-shadow: inset 0 1px 0 rgba(238, 244, 249, .05), 0 15px 34px rgba(4, 10, 16, .20) !important;""", """  background: linear-gradient(145deg, rgba(41, 54, 67, .97), rgba(34, 46, 57, .96)) !important;
  border-color: rgba(184, 202, 218, .18) !important;
  box-shadow: inset 0 1px 0 rgba(241, 245, 249, .045), 0 12px 28px rgba(5, 10, 15, .18) !important;
  animation: none !important;""")
s = s.replace("""  background: rgba(39, 51, 64, .90) !important;
  border-color: rgba(183, 199, 216, .14) !important;
  box-shadow: inset 0 1px 0 rgba(238, 244, 249, .045), 0 10px 24px rgba(4, 10, 16, .17) !important;""", """  background: rgba(37, 49, 60, .95) !important;
  border-color: rgba(184, 202, 218, .15) !important;
  box-shadow: inset 0 1px 0 rgba(241, 245, 249, .04), 0 9px 22px rgba(5, 10, 15, .16) !important;""")
needle = """html[data-theme='dark'][data-ui] body :is(
  input,
  select,
  textarea,
  .input,
  .select,
  .textarea
) {"""
insert = """/* Dark submission-card readability: status remains semantic while card surfaces stay neutral. */
html[data-theme='dark'][data-ui] body .paper-grid .paper-history {
  color: #d4dee8 !important;
  background: rgba(25, 35, 44, .82) !important;
  border-color: rgba(174, 195, 214, .20) !important;
  box-shadow: inset 0 1px 0 rgba(241, 245, 249, .025) !important;
}
html[data-theme='dark'][data-ui] body .paper-grid .paper-status-area > :is(.status-preparing, .status-submitted, .status-under_review, .status-revision, .status-accepted, .status-rejected, .status-withdrawn) { box-shadow: none !important; filter: none !important; }
html[data-theme='dark'][data-ui] body .paper-grid .paper-status-area > .status-preparing { color: #f3c87a !important; border-color: rgba(245, 158, 11, .30) !important; background: rgba(245, 158, 11, .12) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .paper-status-area > .status-submitted { color: #9fc4ff !important; border-color: rgba(96, 165, 250, .30) !important; background: rgba(59, 130, 246, .12) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .paper-status-area > .status-under_review { color: #8fd6e7 !important; border-color: rgba(34, 211, 238, .28) !important; background: rgba(34, 211, 238, .10) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .paper-status-area > .status-revision { color: #c8a9eb !important; border-color: rgba(192, 132, 252, .30) !important; background: rgba(168, 85, 247, .11) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .paper-status-area > .status-accepted { color: #91dfb0 !important; border-color: rgba(74, 222, 128, .29) !important; background: rgba(34, 197, 94, .11) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .paper-status-area > .status-rejected { color: #f2a1aa !important; border-color: rgba(248, 113, 113, .29) !important; background: rgba(239, 68, 68, .11) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .paper-status-area > .status-withdrawn { color: #c0cad5 !important; border-color: rgba(148, 163, 184, .27) !important; background: rgba(148, 163, 184, .10) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot { color: #dce6ef !important; background: rgba(47, 61, 74, .94) !important; border: 1px solid rgba(178, 199, 217, .27) !important; box-shadow: inset 0 1px 0 rgba(241, 245, 249, .045) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot:hover:not(.file-dot-disabled) { color: #f8fafc !important; border-color: rgba(114, 200, 223, .52) !important; background: rgba(58, 78, 94, .98) !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='pdf'] { color: #ffaaaa !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='document'] { color: #a9c8ff !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='sheet'] { color: #9ad8ad !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='slides'] { color: #ffc08f !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='image'] { color: #cfb4ff !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='retrieval'],
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='acceptance'] { color: #91dfb0 !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='proof'],
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='response'] { color: #a9d9ef !important; }
html[data-theme='dark'][data-ui] body .paper-grid .file-dot[data-file-kind='receipt'] { color: #efd08b !important; }

""" + needle
if needle not in s:
    raise SystemExit('dark input contract anchor not found')
s = s.replace(needle, insert, 1)
p.write_text(s, encoding='utf-8')

p = Path('src/luminous-ui.css')
s = p.read_text(encoding='utf-8')
changes = [
("#25293a, #1e2935", "#25313c, #222d37"),
("#20303b, #1e2935", "#25313c, #222d37"),
("#302d25, #1e2935", "#25313c, #222d37"),
("#2d2937, #1e2935", "#25313c, #222d37"),
("#22312f, #1e2935", "#25313c, #222d37"),
("#32282d, #1e2935", "#25313c, #222d37"),
("#252e38, #1e2935", "#25313c, #222d37"),
]
for old, new in changes:
    if old not in s:
        raise SystemExit(f'luminous dark status surface not found: {old}')
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = Path('src/luminous-x-rebuild-corrections.css')
s = p.read_text(encoding='utf-8')
old = '  background-color: #273340 !important;\n  background-image: none !important;'
if old not in s:
    raise SystemExit('Luminous X dark card surface not found')
s = s.replace(old, '  background-color: #25313c !important;\n  background-image: none !important;', 1)
p.write_text(s, encoding='utf-8')

p = Path('src/journal-card-publication-file-final.css')
s = p.read_text(encoding='utf-8')
old = """.paper-grid .file-dot {
  width: 35px !important;
  min-width: 35px !important;
  height: 25px !important;
  min-height: 25px !important;
}

.paper-grid .file-dot::before {
  font-size: 8px !important;
  line-height: 1 !important;
}"""
new = """.paper-grid .file-dot {
  width: 38px !important;
  min-width: 38px !important;
  height: 27px !important;
  min-height: 27px !important;
  border: 1px solid var(--border-subtle) !important;
  background: var(--bg-elevated) !important;
}

.paper-grid .file-dot::before {
  min-width: 0;
  max-width: 34px;
  overflow: hidden;
  font-size: 9px !important;
  line-height: 1 !important;
  text-overflow: ellipsis;
}"""
if old not in s:
    raise SystemExit('card file affordance block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = Path('tests/visual/dark-theme-contract-check.mjs')
s = p.read_text(encoding='utf-8')
s = s.replace("""      const header = document.querySelector('.app-header')
      const cards = Array.from(document.querySelectorAll('.paper-card-v3'))
""", """      const header = document.querySelector('.app-header')
      const cards = Array.from(document.querySelectorAll('.paper-card-v3'))
      const history = document.querySelector('.paper-history')
      const fileDots = Array.from(document.querySelectorAll('.paper-grid .file-dot'))
""", 1)
s = s.replace("""        headerSurface: surfaceFor(header),
        statusCards,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
""", """        headerSurface: surfaceFor(header),
        history: history ? { surface: surfaceFor(history), text: describe(getComputedStyle(history).color) } : null,
        fileDots: fileDots.map(file => ({
          mark: file.dataset.fileMark || '',
          kind: file.dataset.fileKind || '',
          before: getComputedStyle(file, '::before').content,
          text: describe(getComputedStyle(file).color),
          surface: surfaceFor(file),
        })),
        statusCards,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
""", 1)
s = s.replace("""    if (result.pageOverflow > 2) fail(`${ui}: dark dashboard has horizontal overflow of ${result.pageOverflow}px`)

    for (const card of result.statusCards) {
""", """    if (result.pageOverflow > 2) fail(`${ui}: dark dashboard has horizontal overflow of ${result.pageOverflow}px`)

    if (result.history) {
      const historyBg = result.history.surface.backgroundColor.average
      if (historyBg === null || historyBg > 105) fail(`${ui}: version chain still uses a light surface (${result.history.surface.backgroundColor.value})`)
      if (!result.history.text.rgb || result.history.text.average < 150) fail(`${ui}: version chain text is too dim (${result.history.text.value})`)
    }

    for (const file of result.fileDots) {
      if (!file.mark || !file.kind) fail(`${ui}: attachment control is missing semantic file mark/kind`)
      if (!file.before || file.before === 'none' || file.before === 'normal' || file.before === '\"\"') fail(`${ui}: attachment control has no visible pseudo-label (${file.kind || 'unknown'})`)
      if (!file.text.rgb || file.text.average < 120) fail(`${ui}: attachment mark is too dim (${file.text.value})`)
      const fileBg = file.surface.backgroundColor.average
      if (fileBg === null || fileBg < 30 || fileBg > 110) fail(`${ui}: attachment surface is not a readable dark control (${file.surface.backgroundColor.value})`)
    }

    for (const card of result.statusCards) {
""", 1)
p.write_text(s, encoding='utf-8')
