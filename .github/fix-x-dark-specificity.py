from pathlib import Path
p = Path('src/luminous-x-rebuild-corrections.css')
s = p.read_text(encoding='utf-8')
old = """html[data-ui='luminous-x'][data-theme='dark'] .paper-card-v3,
html[data-ui='luminous-x'][data-theme='dark'] .lx-board-stack .paper-card-v3,
html[data-ui='luminous-x'][data-theme='dark'] .lx-journal-group-grid .paper-card-v3 {
"""
new = """html[data-ui='luminous-x'][data-theme='dark'] .paper-grid .paper-card-v3,
html[data-ui='luminous-x'][data-theme='dark'] .lx-board-stack .paper-card-v3,
html[data-ui='luminous-x'][data-theme='dark'] .lx-journal-group-grid .paper-card-v3 {
"""
if old not in s:
    raise SystemExit('final X dark selector block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
