from pathlib import Path

p = Path('src/luminous-x-rebuild-corrections.css')
s = p.read_text(encoding='utf-8')
block = """
/* Dark cards stay materially neutral; semantic color belongs to status controls and a restrained edge. */
html[data-ui='luminous-x'][data-theme='dark'] .paper-card-v3,
html[data-ui='luminous-x'][data-theme='dark'] .lx-board-stack .paper-card-v3,
html[data-ui='luminous-x'][data-theme='dark'] .lx-journal-group-grid .paper-card-v3 {
  --paper-card-start: #25313c !important;
  --paper-card-end: #222d37 !important;
  --paper-card-border: color-mix(in srgb, var(--paper-status-color) 20%, #455463) !important;
  background-color: var(--paper-card-end) !important;
  background-image: linear-gradient(var(--paper-card-angle), var(--paper-card-start), var(--paper-card-end)) !important;
}
"""
if block.strip() in s:
    raise SystemExit('final X dark material block already exists')
s = s.rstrip() + '\n' + block
p.write_text(s, encoding='utf-8')

p = Path('tests/visual/dark-theme-contract-check.mjs')
s = p.read_text(encoding='utf-8')
old = """    if (ui === 'luminous-x') {
      const xCardStarts = [...new Set(result.statusCards.map(card => card.cardStart).filter(Boolean))]
      if (xCardStarts.length > 1) fail(`${ui}: dark card interiors still vary by status (${xCardStarts.join(', ')})`)
    }
"""
new = """    if (ui === 'luminous-x') {
      const xCardStarts = [...new Set(result.statusCards.map(card => card.cardStart).filter(Boolean))]
      if (xCardStarts.length > 1) fail(`${ui}: dark card interiors still vary by status (${xCardStarts.join(', ')})`)
      const glowingCards = result.statusCards.filter(card => card.backgroundImage.includes('radial-gradient'))
      if (glowingCards.length) fail(`${ui}: ${glowingCards.length} dark cards still use decorative status glow fields`)
    }
"""
if old not in s:
    raise SystemExit('Luminous X dark material assertion block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
