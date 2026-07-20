from pathlib import Path


def dedupe_exact(path: str, block: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    while text.count(block) > 1:
        text = text.replace(block + block, block)
        if text.count(block) > 1:
            first = text.find(block)
            second = text.find(block, first + len(block))
            text = text[:second] + text[second + len(block):]
    file.write_text(text, encoding='utf-8')


# Remove duplicate imports/state/effects caused by the repeated one-shot run.
prep = Path('src/components/PreparationWorkspace.tsx')
text = prep.read_text(encoding='utf-8')
text = text.replace("import { useTheme } from '../lib/theme'\nimport { useTheme } from '../lib/theme'\n", "import { useTheme } from '../lib/theme'\n")
state_block = """  const { uiMode } = useTheme()
  const [luminousXActionSlot, setLuminousXActionSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setLuminousXActionSlot(uiMode === 'luminous-x' ? document.getElementById('lx-preparation-actions-slot') : null)
  }, [uiMode])
"""
while text.count(state_block) > 1:
    first = text.find(state_block)
    second = text.find(state_block, first + len(state_block))
    text = text[:second] + text[second + len(state_block):]
prep.write_text(text, encoding='utf-8')

stats = Path('src/components/PersonalStatsUnified.tsx')
text = stats.read_text(encoding='utf-8')
text = text.replace("import { createPortal } from 'react-dom'\nimport { createPortal } from 'react-dom'\n", "import { createPortal } from 'react-dom'\n")
text = text.replace("import { useTheme } from '../lib/theme'\nimport { useTheme } from '../lib/theme'\n", "import { useTheme } from '../lib/theme'\n")
state_pair = """  const { uiMode } = useTheme()
  const [luminousHeaderSlot, setLuminousHeaderSlot] = useState<HTMLElement | null>(null)
"""
while text.count(state_pair) > 1:
    first = text.find(state_pair)
    second = text.find(state_pair, first + len(state_pair))
    text = text[:second] + text[second + len(state_pair):]
effect = """  useEffect(() => {
    setLuminousHeaderSlot(uiMode === 'luminous' ? document.getElementById('luminous-header-center-slot') : null)
  }, [uiMode])
"""
while text.count(effect) > 1:
    first = text.find(effect)
    second = text.find(effect, first + len(effect))
    text = text[:second] + text[second + len(effect):]
stats.write_text(text, encoding='utf-8')

# Keep one copy of each appended design block.
for path, marker in [
    ('src/luminous-x-rebuild-corrections.css', '/* Screenshot-driven alignment: real actions occupy the center lane, subsection controls stay right. */'),
    ('src/luminous-ui.css', '/* Neutral canvas keeps colored modules legible instead of tinting the whole page blue. */'),
]:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    positions = []
    cursor = 0
    while True:
        index = text.find(marker, cursor)
        if index < 0:
            break
        positions.append(index)
        cursor = index + len(marker)
    if len(positions) > 1:
        text = text[:positions[1]].rstrip() + '\n'
    file.write_text(text, encoding='utf-8')

# Dedupe test insertions when the patch ran twice.
test = Path('tests/visual/luminous-coherence-check.mjs')
text = test.read_text(encoding='utf-8')
for line in [
    "      draftTitle: (() => { const element = document.querySelector('.prep-overview-draft-list .prep-draft-card.compact h3'); const style = element ? getComputedStyle(element) : null; return element && style ? { whiteSpace: style.whiteSpace, height: element.getBoundingClientRect().height, scrollHeight: element.scrollHeight } : null })(),\n",
    "      prepPortal: !!document.querySelector('#lx-preparation-actions-slot .prep-top-actions-portal'),\n",
    "    if (ui === 'luminous-x' && !geometry.prepPortal) failures.push(`${name}: preparation actions were not moved into the Luminous X header`)\n",
    "    if (!geometry.draftTitle || geometry.draftTitle.whiteSpace === 'nowrap' || geometry.draftTitle.height < 26) failures.push(`${name}: compact draft title is still restricted to one line`)\n",
]:
    while text.count(line) > 1:
        text = text.replace(line + line, line)
        if text.count(line) > 1:
            first = text.find(line)
            second = text.find(line, first + len(line))
            text = text[:second] + text[second + len(line):]
test.write_text(text, encoding='utf-8')

# Restore the permanent verification-only workflow.
workflow = '''name: Verify Luminous interfaces and onboarding

on:
  pull_request:
    branches: [main]
    paths:
      - 'src/**'
      - 'tests/visual/**'
      - 'vite.config.visual.ts'
      - '.github/workflows/luminous-x-onboarding-review.yml'
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'tests/visual/**'
      - 'vite.config.visual.ts'
      - '.github/workflows/luminous-x-onboarding-review.yml'

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci --no-audit --no-fund
      - name: Typecheck and build visual harness
        run: npm run typecheck && npx vite build --config vite.config.visual.ts
      - name: Install browser runtime
        run: |
          npm install --no-save --no-package-lock playwright@1.52.0
          npx playwright install --with-deps chromium > /tmp/playwright-install.log 2>&1
      - name: Start visual preview
        run: |
          npx vite preview --config vite.config.visual.ts --host 127.0.0.1 --port 4174 > /tmp/submission-hub-focused.log 2>&1 &
          for i in {1..40}; do
            curl -fsS http://127.0.0.1:4174/tests/visual/index.html >/dev/null && exit 0
            sleep 1
          done
          cat /tmp/submission-hub-focused.log
          exit 1
      - name: Review 1 - compact Luminous X layouts
        run: node tests/visual/luminous-x-compact-check.mjs
      - name: Review 2 - cross-interface coherence and modal layering
        if: always()
        run: node tests/visual/luminous-coherence-check.mjs
      - name: Review 3 - two-mode migration and email authentication
        if: always()
        run: node tests/visual/email-auth-check.mjs
      - name: Review 4 - remembered navigation
        if: always()
        run: node tests/visual/navigation-memory-check.mjs
      - name: Review 5 - first-run guide and defaults
        if: always()
        run: node tests/visual/first-run-guide-check.mjs
      - name: Capture focused comparison pages
        if: always()
        run: |
          mkdir -p focused-review
          npx playwright screenshot --timeout=45000 --browser chromium --viewport-size="1440,1000" --wait-for-selector=".preparation-workspace" "http://127.0.0.1:4174/tests/visual/index.html?view=preparation&theme=light&ui=luminous" focused-review/luminous-preparation-light.png
          npx playwright screenshot --timeout=45000 --browser chromium --viewport-size="1440,1000" --wait-for-selector=".preparation-workspace" "http://127.0.0.1:4174/tests/visual/index.html?view=preparation&theme=dark&ui=luminous" focused-review/luminous-preparation-dark.png
          npx playwright screenshot --timeout=45000 --browser chromium --viewport-size="1440,1000" --wait-for-selector=".preparation-workspace" "http://127.0.0.1:4174/tests/visual/index.html?view=preparation&theme=light&ui=luminous-x" focused-review/luminous-x-preparation-light.png
          npx playwright screenshot --timeout=45000 --browser chromium --viewport-size="1440,1000" --wait-for-selector=".preparation-workspace" "http://127.0.0.1:4174/tests/visual/index.html?view=preparation&theme=dark&ui=luminous-x" focused-review/luminous-x-preparation-dark.png
          npx playwright screenshot --timeout=45000 --browser chromium --viewport-size="1280,900" --wait-for-selector=".first-run-guide" "http://127.0.0.1:4174/tests/visual/index.html?view=dashboard&theme=light&ui=luminous-x&guide=1" focused-review/luminous-x-first-run-guide.png
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: luminous-two-interface-review
          path: |
            focused-review/*
            /tmp/submission-hub-focused.log
          retention-days: 14
'''
Path('.github/workflows/luminous-x-onboarding-review.yml').write_text(workflow, encoding='utf-8')

for temporary in [
    '.github/workflows/temporary-refine-ui-layout.yml',
    'scripts/refine_ui_alignment.py',
    'scripts/refine_ui_alignment_v2.py',
    'scripts/cleanup_ui_alignment_patch.py',
    'tmp-ui-pr-trigger',
]:
    path = Path(temporary)
    if path.exists():
        path.unlink()
