import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { settle, shot } from './helpers';

/**
 * Maakt de afbeeldingen van de voorbeeldontwerpen op de homepage, rechtstreeks uit de echte
 * 3D-weergave. Draai opnieuw na wijzigingen in de catalogus of de generator:
 *
 *   npm run capture
 */
const EXAMPLES = ['garage-kracht', 'slaapkamer-starter', 'bijgebouw-compleet'];
const OUT = path.join('public', 'examples');

test.describe('@capture voorbeeldafbeeldingen', () => {
  test.use({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });

  for (const id of EXAMPLES) {
    test(`afbeelding van ${id}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.getByTestId(`open-example-${id}`).click();
      await page.waitForFunction(() => !!window.__homegym?.scene()?.floor, undefined, { timeout: 60_000 });
      await settle(page, 1500);

      // Alleen de ruimte in beeld: bediening en labels verbergen.
      await page.addStyleTag({
        content: `[data-testid="scene-labels"], main > div.pointer-events-none, [aria-live="polite"] { display: none !important; }`,
      });
      const box = await page.locator('main').boundingBox();
      if (!box) throw new Error('3D-weergave niet gevonden');
      // Uitsnede in 4:3, gecentreerd in de weergave.
      const height = Math.min(box.height, 660);
      const width = Math.round((height * 4) / 3);
      await settle(page, 400);
      await page.screenshot({
        path: path.join(OUT, `${id}.jpg`),
        type: 'jpeg',
        quality: 84,
        clip: { x: Math.round(box.x + (box.width - width) / 2), y: Math.round(box.y + (box.height - height) / 2), width, height },
      });
      await shot(page, `voorbeeld-${id}`);
    });
  }
});
