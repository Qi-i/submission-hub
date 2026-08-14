from pathlib import Path

p = Path('src/luminous-x-rebuild-corrections.css')
s = p.read_text(encoding='utf-8')
starts = ['#2b3041', '#243b47', '#3a3529', '#342e3d', '#283a36', '#3a2d31', '#2f3944']
for start in starts:
    token = f'  --paper-card-start: {start};\n  --paper-card-end: #273340;'
    replacement = '  --paper-card-start: #25313c;\n  --paper-card-end: #222d37;'
    if token not in s:
        raise SystemExit(f'Luminous X dark status surface not found: {start}')
    s = s.replace(token, replacement, 1)
p.write_text(s, encoding='utf-8')

p = Path('tests/visual/dark-theme-contract-check.mjs')
s = p.read_text(encoding='utf-8')
old = """      const statusCards = cards.map(card => ({
        status: card.querySelector('.paper-status-area')?.getAttribute('data-status') || 'unknown',
        ...surfaceFor(card),
      }))
"""
new = """      const statusCards = cards.map(card => {
        const style = getComputedStyle(card)
        return {
          status: card.querySelector('.paper-status-area')?.getAttribute('data-status') || 'unknown',
          cardStart: style.getPropertyValue('--paper-card-start').trim(),
          ...surfaceFor(card),
        }
      })
"""
if old not in s:
    raise SystemExit('status card measurement block not found')
s = s.replace(old, new, 1)
old = """    for (const card of result.statusCards) {
      const values = card.imageColors.map(color => color.average)
"""
new = """    if (ui === 'luminous-x') {
      const xCardStarts = [...new Set(result.statusCards.map(card => card.cardStart).filter(Boolean))]
      if (xCardStarts.length > 1) fail(`${ui}: dark card interiors still vary by status (${xCardStarts.join(', ')})`)
    }

    for (const card of result.statusCards) {
      const values = card.imageColors.map(color => color.average)
"""
if old not in s:
    raise SystemExit('status card assertion anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
