from pathlib import Path


def require_replace(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"Expected {label} block was not found")
    return text.replace(old, new, 1)


prep = Path('src/components/PreparationWorkspace.tsx')
text = prep.read_text(encoding='utf-8')
old = "  const [luminousXActionSlot, setLuminousXActionSlot] = useState<HTMLElement | null>(null)\n\n  useEffect(() => {\n    setLuminousXActionSlot(uiMode === 'luminous-x' ? document.getElementById('lx-preparation-actions-slot') : null)\n  }, [uiMode])\n"
new = "  const [luminousXActionSlot, setLuminousXActionSlot] = useState<HTMLElement | null>(null)\n  const [canPortalActions, setCanPortalActions] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1421px)').matches)\n\n  useEffect(() => {\n    setLuminousXActionSlot(uiMode === 'luminous-x' ? document.getElementById('lx-preparation-actions-slot') : null)\n  }, [uiMode])\n\n  useEffect(() => {\n    const media = window.matchMedia('(min-width: 1421px)')\n    const sync = () => setCanPortalActions(media.matches)\n    sync()\n    media.addEventListener('change', sync)\n    return () => media.removeEventListener('change', sync)\n  }, [])\n"
text = require_replace(text, old, new, 'preparation portal')
text = text.replace("uiMode === 'luminous-x' && luminousXActionSlot ? createPortal(", "uiMode === 'luminous-x' && canPortalActions && luminousXActionSlot ? createPortal(")
prep.write_text(text, encoding='utf-8')

stats = Path('src/components/PersonalStatsUnified.tsx')
text = stats.read_text(encoding='utf-8')
old = "  const [luminousHeaderSlot, setLuminousHeaderSlot] = useState<HTMLElement | null>(null)\n  const [visible, setVisible] = useState<Record<TrendKey, boolean>>({\n"
new = "  const [luminousHeaderSlot, setLuminousHeaderSlot] = useState<HTMLElement | null>(null)\n  const [canPortalControls, setCanPortalControls] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 981px)').matches)\n  const [visible, setVisible] = useState<Record<TrendKey, boolean>>({\n"
text = require_replace(text, old, new, 'statistics portal state')
effect = "  useEffect(() => {\n    setLuminousHeaderSlot(uiMode === 'luminous' ? document.getElementById('luminous-header-center-slot') : null)\n  }, [uiMode])\n"
media_effect = effect + "\n  useEffect(() => {\n    const media = window.matchMedia('(min-width: 981px)')\n    const sync = () => setCanPortalControls(media.matches)\n    sync()\n    media.addEventListener('change', sync)\n    return () => media.removeEventListener('change', sync)\n  }, [])\n"
if 'setCanPortalControls(media.matches)' not in text:
    if effect not in text:
        raise RuntimeError('Expected statistics portal effect was not found')
    text = text.replace(effect, media_effect, 1)
text = text.replace("uiMode === 'luminous' && luminousHeaderSlot ? createPortal(", "uiMode === 'luminous' && canPortalControls && luminousHeaderSlot ? createPortal(")
text = text.replace("  }, [uiMode])\n\n\n\n  const summary", "  }, [uiMode])\n\n  const summary")
stats.write_text(text, encoding='utf-8')

offline = Path('src/components/OfflineDashboard.tsx')
text = offline.read_text(encoding='utf-8')
slot = '        <div id="luminous-header-center-slot" className="luminous-header-center-slot" aria-label="当前页面操作" />\n'
if slot not in text:
    needle = '        </div>\n        <div className="header-actions">\n'
    if needle not in text:
        raise RuntimeError('Expected offline header boundary was not found')
    text = text.replace(needle, '        </div>\n' + slot + '        <div className="header-actions">\n', 1)
    offline.write_text(text, encoding='utf-8')

for path, selector in [
    (Path('src/luminous-ui.css'), "html[data-ui='luminous'] .stats-panel.stats-panel-unified"),
    (Path('src/luminous-x-rebuild-corrections.css'), "html[data-ui='luminous-x'] .stats-panel.stats-panel-unified"),
]:
    text = path.read_text(encoding='utf-8')
    old = selector + " {\n  margin: 0 !important;"
    new = selector + " {\n  margin-top: 0 !important;\n  margin-bottom: 0 !important;\n  margin-left: auto !important;\n  margin-right: auto !important;"
    if old in text:
        text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')

lx = Path('src/luminous-x-rebuild-corrections.css')
text = lx.read_text(encoding='utf-8').replace("@media (max-width: 1220px) {\n  html[data-ui='luminous-x'] .lx-status-bar[data-page='preparation'] .lx-status-controls-host", "@media (max-width: 1420px) {\n  html[data-ui='luminous-x'] .lx-status-bar[data-page='preparation'] .lx-status-controls-host", 1)
lx.write_text(text, encoding='utf-8')

lum = Path('src/luminous-ui.css')
text = lum.read_text(encoding='utf-8')
marker = "html[data-ui='luminous'] .preparation-workspace .prep-overview-draft-list .prep-draft-card.compact h3 {"
dark = """html[data-ui='luminous'][data-theme='dark'] .paper-card-v3:has(.paper-status-area[data-status='preparing']) { background: linear-gradient(155deg, #1b1a37, #11182d) padding-box, linear-gradient(135deg, #34315a, rgba(139, 92, 246, .42)) border-box !important; }
html[data-ui='luminous'][data-theme='dark'] .paper-card-v3:has(.paper-status-area[data-status='submitted']) { background: linear-gradient(155deg, #10283a, #11182d) padding-box, linear-gradient(135deg, #28506a, rgba(60, 245, 255, .34)) border-box !important; }
html[data-ui='luminous'][data-theme='dark'] .paper-card-v3:has(.paper-status-area[data-status='under_review']) { background: linear-gradient(155deg, #2d2414, #11182d) padding-box, linear-gradient(135deg, #5d4a25, rgba(245, 158, 11, .38)) border-box !important; }
html[data-ui='luminous'][data-theme='dark'] .paper-card-v3:has(.paper-status-area[data-status='revision']) { background: linear-gradient(155deg, #291936, #11182d) padding-box, linear-gradient(135deg, #513163, rgba(255, 79, 159, .36)) border-box !important; }
html[data-ui='luminous'][data-theme='dark'] .paper-card-v3:has(.paper-status-area[data-status='accepted']) { background: linear-gradient(155deg, #132b22, #11182d) padding-box, linear-gradient(135deg, #28533f, rgba(34, 197, 94, .36)) border-box !important; }
html[data-ui='luminous'][data-theme='dark'] .paper-card-v3:has(.paper-status-area[data-status='rejected']) { background: linear-gradient(155deg, #30191f, #11182d) padding-box, linear-gradient(135deg, #61303a, rgba(239, 68, 68, .38)) border-box !important; }
html[data-ui='luminous'][data-theme='dark'] .paper-card-v3:has(.paper-status-area[data-status='withdrawn']) { background: linear-gradient(155deg, #1a2230, #11182d) padding-box, linear-gradient(135deg, #354153, rgba(100, 116, 139, .34)) border-box !important; }

"""
if "data-theme='dark'] .paper-card-v3:has(.paper-status-area[data-status='preparing'])" not in text:
    if marker not in text:
        raise RuntimeError('Expected Luminous draft marker was not found')
    text = text.replace(marker, dark + marker, 1)
    lum.write_text(text, encoding='utf-8')
