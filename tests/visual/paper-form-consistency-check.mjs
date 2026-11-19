import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const url = 'http://127.0.0.1:4174/tests/visual/paper-form-consistency.html'

async function openEditor() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.locator('.compact-form-modal').waitFor()
  return page
}

try {
  const unchanged = await openEditor()
  await unchanged.locator('.compact-footer-actions button', { hasText: '保存' }).click()
  await unchanged.locator('[data-editor-closed]').waitFor()
  assert.deepEqual(await unchanged.evaluate(() => ({
    closed: window.__paperFormProbe.closed,
    saved: window.__paperFormProbe.saved.length,
  })), { closed: 1, saved: 0 }, 'unchanged Save must not write')
  await unchanged.close()

  const status = await openEditor()
  await status.locator('.input.title-input').fill('A revised fictional sensor study')
  await status.locator('.compact-footer-actions button', { hasText: '保存' }).click()
  await status.locator('[data-editor-closed]').waitFor()
  const saved = await status.evaluate(() => window.__paperFormProbe.saved[0])
  assert.equal(saved.status, 'under_review', '拟录用 must not become formally accepted')
  assert.equal(saved.system_status, '拟录用')
  await status.close()

  const upload = await openEditor()
  const original = 'r2-storage://submission-hub/demo-original.pdf'
  const ref = upload.locator('.archive-file-row input[type="hidden"]')
  const name = upload.locator('.archive-file-row .compact-file-name')
  const replace = upload.locator('.archive-file-row button[title="替换文件"]')
  assert.equal(await ref.inputValue(), original)

  const [chooser] = await Promise.all([upload.waitForEvent('filechooser'), replace.click()])
  await chooser.setFiles({ name: 'new.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-test') })
  await upload.waitForFunction(() => !!window.__paperFormProbe.pending)
  assert.equal(await ref.inputValue(), original, 'pending upload must preserve the private URL')
  assert.equal(await name.inputValue(), 'original.pdf', 'pending upload must preserve the old name')
  assert.equal(await upload.locator('.compact-file-head button').isDisabled(), true)
  upload.once('dialog', dialog => dialog.accept())
  await upload.evaluate(() => window.__paperFormProbe.pending.reject(new Error('simulated upload failure')))
  await upload.waitForFunction(() => !window.__paperFormProbe.pending)
  assert.equal(await ref.inputValue(), original, 'failed upload must not destroy the archived file')
  assert.equal(await name.inputValue(), 'original.pdf')

  const [chooser2] = await Promise.all([upload.waitForEvent('filechooser'), replace.click()])
  await chooser2.setFiles({ name: 'new.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-test') })
  await upload.waitForFunction(() => !!window.__paperFormProbe.pending)
  await upload.evaluate(() => window.__paperFormProbe.pending.resolve({
    fileUrl: 'r2-storage://submission-hub/demo-new.pdf',
    fileName: 'new.pdf',
  }))
  await upload.waitForFunction(() => document.querySelector('.archive-file-row input[type="hidden"]')?.value === 'r2-storage://submission-hub/demo-new.pdf')
  assert.equal(await name.inputValue(), 'new.pdf')
  await upload.locator('.compact-footer-actions button', { hasText: '保存' }).click()
  await upload.locator('[data-editor-closed]').waitFor()
  const updatedFiles = await upload.evaluate(() => window.__paperFormProbe.saved[0].files)
  assert.equal(updatedFiles[0].p, 'r2-storage://submission-hub/demo-new.pdf')
  assert.equal(updatedFiles[0].n, 'new.pdf')
  await upload.close()

  const discard = await openEditor()
  await discard.locator('.input.title-input').fill('Unsaved fictional change')
  discard.once('dialog', dialog => dialog.dismiss())
  await discard.locator('.compact-footer-actions button', { hasText: '取消' }).click()
  assert.equal(await discard.locator('.compact-form-modal').isVisible(), true, 'dismissed discard must retain the draft')
  discard.once('dialog', dialog => dialog.accept())
  await discard.locator('.compact-footer-actions button', { hasText: '取消' }).click()
  await discard.locator('[data-editor-closed]').waitFor()
  assert.equal(await discard.evaluate(() => window.__paperFormProbe.closed), 1)
  await discard.close()
  console.log('Manuscript editor: unchanged Save, tentative status, atomic attachment replacement, unsaved discard passed')
} finally {
  await browser.close()
}
