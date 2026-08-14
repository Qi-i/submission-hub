from pathlib import Path

p = Path('tests/visual/ui-geometry-contract-check.mjs')
s = p.read_text(encoding='utf-8')
old = "  'radial-gradient(ellipse at 10% 4%',\n"
new = "  'background-image: linear-gradient(180deg, #1b242d',\n"
if old not in s:
    raise SystemExit('legacy dark radial source assertion not found')
s = s.replace(old, new, 1)
old = "    if (!dark.bodyBackground.includes('radial-gradient')) fail(`${ui}/dark: spatial background fields are missing`)\n"
new = "    if (!dark.bodyBackground.includes('linear-gradient')) fail(`${ui}/dark: calm blue-gray background field is missing`)\n    if (dark.bodyBackground.includes('radial-gradient')) fail(`${ui}/dark: decorative radial glow fields remain in the production dark workspace`)\n"
if old not in s:
    raise SystemExit('legacy dark radial runtime assertion not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
