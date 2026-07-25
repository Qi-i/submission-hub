function normalizeText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function normalizeIdentity(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

function isRecognizedAcronym(value: string) {
  const compact = value.replace(/[.\s_-]+/g, '')
  return /^[A-Z][A-Z0-9&]{1,9}$/.test(compact)
}

function shouldShowAbbreviation(name: string, abbreviation: string) {
  const title = normalizeText(name)
  const short = normalizeText(abbreviation)
  if (!title || !short) return false
  if (normalizeIdentity(title) === normalizeIdentity(short)) return false

  // Keep concise, recognizable journal acronyms such as JRMGE and NHESS.
  if (isRecognizedAcronym(short)) return true

  const titleWords = title.split(/\s+/).filter(Boolean)
  const compactTitleLength = title.replace(/[^A-Za-z0-9]/g, '').length
  const compactShortLength = short.replace(/[^A-Za-z0-9]/g, '').length

  // Short journal titles do not need a second abbreviated-name chip.
  if (titleWords.length <= 2 && compactTitleLength <= 24) return false

  // Long ISO-style abbreviations are useful in metadata, but not as card labels.
  if (short.length > 18 || compactShortLength > 16) return false
  if (compactShortLength >= compactTitleLength * 0.72) return false
  return true
}

function updateIdentity(host: HTMLElement) {
  const card = host.closest<HTMLElement>('.prep-journal-card, .prep-journal-overview-card')
  if (!card) return
  const name = normalizeText(card.querySelector<HTMLElement>('.prep-journal-card-main > h3, .prep-overview-journal-copy > b')?.textContent)
  const chineseName = host.querySelector<HTMLElement>('strong')
  const abbreviation = host.querySelector<HTMLElement>('em')

  if (chineseName) {
    const text = normalizeText(chineseName.textContent)
    chineseName.hidden = !text
    if (text && chineseName.title !== text) chineseName.title = text
  }

  if (abbreviation) {
    const text = normalizeText(abbreviation.textContent)
    const visible = shouldShowAbbreviation(name, text)
    abbreviation.hidden = !visible
    abbreviation.toggleAttribute('data-hidden-abbreviation', !visible)
    if (visible && abbreviation.title !== text) abbreviation.title = text
  }

  const hasChineseName = !!chineseName && !chineseName.hidden
  const hasAbbreviation = !!abbreviation && !abbreviation.hidden
  host.hidden = !hasChineseName && !hasAbbreviation
  host.toggleAttribute('data-chinese-only', hasChineseName && !hasAbbreviation)
}

function updateFormHint(modal: HTMLElement) {
  const field = Array.from(modal.querySelectorAll<HTMLElement>('.prep-field')).find(item =>
    normalizeText(item.querySelector(':scope > span')?.textContent) === '缩写',
  )
  const input = field?.querySelector<HTMLInputElement>('input')
  if (!input) return
  const placeholder = '仅填学界或期刊公认简称（如 JRMGE、NHESS）；短刊名可留空'
  if (input.placeholder !== placeholder) input.placeholder = placeholder
}

function enhanceAll() {
  document.querySelectorAll<HTMLElement>('.prep-journal-local-identity').forEach(updateIdentity)
  document.querySelectorAll<HTMLElement>('.journal-form-modal').forEach(updateFormHint)
}

function scheduleFactory(callback: () => void) {
  let frame = 0
  return () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(callback)
  }
}

function start() {
  const schedule = scheduleFactory(enhanceAll)
  enhanceAll()
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  window.addEventListener('resize', schedule, { passive: true })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
else start()
