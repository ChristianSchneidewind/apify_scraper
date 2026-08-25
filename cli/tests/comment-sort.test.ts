import { afterAll, describe, expect, it } from 'vitest';
import { selectNewestCommentSort } from '../src/modules/scrape-comments/page-setup.ts';
import { findChromeBinary, launchCdpFixture, setFixtureContent } from './cdp-fixture.ts';

describe.skipIf(!findChromeBinary())('comment sorting (cdp fixture)', () => {
  const fixturePromise = launchCdpFixture();

  afterAll(async () => {
    const fixture = await fixturePromise;
    await fixture?.close();
  });

  it('selects Neueste when the trigger text touches the SVG title', async () => {
    const fixture = await fixturePromise;
    expect(fixture).not.toBeNull();
    const page = fixture!.page;
    await setFixtureContent(page, `
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
    }, undefined);

    await expect(selectNewestCommentSort(page)).resolves.toBe('selected_newest');
    const triggerText = await page.locator('#sort').evaluate((el: Element) => el.textContent, undefined);
    expect(triggerText).toContain('Neueste');
  });
});
