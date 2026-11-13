import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const url = 'https://qi-i.github.io/submission-hub/qihub/';
const out = 'qihub-live-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[1440, 900], [390, 844], [360, 740], [320, 568]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    assert.equal(response.status(), 200);
    await page.locator('.overview-home .project-card').first().waitFor();
    const actual = await page.locator('.overview-home a.project-card').evaluateAll(
      (elements) => elements.map((e) => ({ name: e.textContent, url: e.href, target: e.target })),
    );
    assert.equal(actual.length, 3, 'Exactly three native project links');
    for (const [index, prefix] of [
      'https://qiledger.pages.dev/',
      'https://qi-i.github.io/live-memory/',
      'https://qi-i.github.io/submission-hub/',
    ].entries()) {
      assert.equal(actual[index].url, prefix);
      assert.equal(actual[index].target, '_blank');
    }
    const dimensions = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.overview-home .project-card')];
      const strip = document.querySelector('.overview-home .home-sync-bar');
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        cards: cards.map((e) => e.getBoundingClientRect().bottom),
        statusBottom: strip?.getBoundingClientRect().bottom ?? -1,
      };
    });
    assert.ok(dimensions.width <= width + 2, 'Horizontal overflow: ' + JSON.stringify({width, height, dimensions}));
    if (width < 500) {
      assert.ok(dimensions.cards.every((bottom) => bottom <= height - 2));
      assert.ok(dimensions.statusBottom > 0 && dimensions.statusBottom <= height - 2,
        'Last status strip is not visible: ' + JSON.stringify({width, height, dimensions}));
      assert.ok(dimensions.height <= height + 2,
        'Mobile launcher must fit on first screen: ' + JSON.stringify({width, height, dimensions}));
      const shortcut = page.getByRole('button', { name: '快速打开应用' });
      await shortcut.click();
      assert.equal(await page.getByRole('menuitem').count(), 3);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('menuitem').count(), 0);
    }
    assert.deepEqual(errors, [], 'Unexpected page errors');
    if (width === 1440 || width === 390) {
      await page.screenshot({ path: out + '/' + width + 'x' + height + '.png' });
    }
    await page.close();
  }
  console.log('Public QiHub Web passed real Chromium review across four viewports');
} finally {
  await browser.close();
}
