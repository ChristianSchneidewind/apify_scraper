import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { selectNewestCommentSort } from '../src/modules/scrape-comments/page-setup.ts';

describe('comment sorting', () => {
  it('selects Neueste when the trigger text touches the SVG title', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(`
        <div role="dialog">
          <div id="sort" role="button" tabindex="0" aria-expanded="false" aria-haspopup="menu">
            <span>Für dich</span><svg><title>„Pfeil nach unten“-Symbol</title></svg>
          </div>
          <div id="menu" role="menu" style="display:none"><button id="newest">Neueste</button></div>
        </div>
      `);
      await page.evaluate(() => {
        const trigger = document.querySelector('#sort') as HTMLElement;
        const menu = document.querySelector('#menu') as HTMLElement;
        trigger.addEventListener('click', () => {
          trigger.setAttribute('aria-expanded', 'true');
          menu.style.display = 'block';
        });
        document.querySelector('#newest')?.addEventListener('click', () => {
          trigger.setAttribute('aria-expanded', 'false');
          trigger.innerHTML = '<span>Neueste</span><svg><title>„Pfeil nach unten“-Symbol</title></svg>';
          menu.style.display = 'none';
        });
      });

      await expect(selectNewestCommentSort(page as never)).resolves.toBe('selected_newest');
      expect(await page.locator('#sort').textContent()).toContain('Neueste');
    } finally {
      await browser.close();
    }
  });
});
