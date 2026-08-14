from pathlib import Path

css = Path('src/luminous-x-rebuild.css')
text = css.read_text(encoding='utf-8')
old = """  --lx-cyan: #72c8df;
  --lx-magenta: #d58bab;
  --lx-purple: #9e91d4;"""
new = """  --lx-cyan: #3cf5ff;
  --lx-magenta: #ff4f9f;
  --lx-purple: #8b5cf6;"""
if old not in text:
    raise SystemExit('global Luminous X color tokens not found')
text = text.replace(old, new, 1)
marker = """html[data-ui='luminous-x'][data-theme='dark'] {
  --bg-base: #1e2630;"""
replacement = """html[data-ui='luminous-x'][data-theme='dark'] {
  --lx-cyan: #72c8df;
  --lx-magenta: #d58bab;
  --lx-purple: #9e91d4;
  --bg-base: #1e2630;"""
if marker not in text:
    raise SystemExit('dark Luminous X token block not found')
css.write_text(text.replace(marker, replacement, 1), encoding='utf-8')

test = Path('tests/visual/luminous-x-layout-check.mjs')
text = test.read_text(encoding='utf-8')
old = """    if (root.dataset.ui !== 'luminous-x') failures.push(`${name}: Luminous X mode is not active`)
    if (rootStyle.getPropertyValue('--lx-cyan').trim().toLowerCase() !== '#3cf5ff') failures.push(`${name}: cyan token is incorrect`)
    if (rootStyle.getPropertyValue('--lx-magenta').trim().toLowerCase() !== '#ff4f9f') failures.push(`${name}: magenta token is incorrect`)
    if (rootStyle.getPropertyValue('--lx-purple').trim().toLowerCase() !== '#8b5cf6') failures.push(`${name}: purple token is incorrect`)"""
new = """    if (root.dataset.ui !== 'luminous-x') failures.push(`${name}: Luminous X mode is not active`)
    const expectedTokens = root.dataset.theme === 'dark'
      ? { cyan: '#72c8df', magenta: '#d58bab', purple: '#9e91d4' }
      : { cyan: '#3cf5ff', magenta: '#ff4f9f', purple: '#8b5cf6' }
    if (rootStyle.getPropertyValue('--lx-cyan').trim().toLowerCase() !== expectedTokens.cyan) failures.push(`${name}: cyan token is incorrect`)
    if (rootStyle.getPropertyValue('--lx-magenta').trim().toLowerCase() !== expectedTokens.magenta) failures.push(`${name}: magenta token is incorrect`)
    if (rootStyle.getPropertyValue('--lx-purple').trim().toLowerCase() !== expectedTokens.purple) failures.push(`${name}: purple token is incorrect`)"""
if old not in text:
    raise SystemExit('Luminous X token assertions not found')
test.write_text(text.replace(old, new, 1), encoding='utf-8')
