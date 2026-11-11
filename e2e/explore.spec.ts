import { test } from '@playwright/test';
import { addProduct, openConfigurator, settle, shot } from './helpers';

/** Verkennende schermafbeeldingen om het ontwerp visueel te beoordelen. Draai met: npx playwright test explore */
test('@explore visuele verkenning', async ({ page }) => {
  let step = 'start';
  page.on('pageerror', (e) => console.log(`PAGEERROR tijdens "${step}": ${e.stack?.split('\n').slice(0, 6).join(' | ')}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`CONSOLE-ERROR tijdens "${step}": ${m.text().slice(0, 300)}`));

  step = 'home';
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3500);
  await shot(page, 'x-home-hero');
  for (const [id, name] of [
    ['#zo-werkt-het', 'x-home-stappen'],
    ['#echte-maten', 'x-home-maten'],
    ['#voorbeelden', 'x-home-voorbeelden'],
    ['#realisatie', 'x-home-realisatie'],
  ]) {
    await page.locator(id).scrollIntoViewIfNeeded();
    await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior }), id);
    await page.waitForTimeout(500);
    await shot(page, name);
  }
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' as ScrollBehavior }));
  await page.waitForTimeout(400);
  await shot(page, 'x-home-footer');

  step = 'configurator';
  await openConfigurator(page, { fresh: false });
  await shot(page, 'x-config-empty');

  step = 'genereren';
  await page.getByTestId('tab-indeling').click();
  await page.getByTestId('profile-compleet').click();
  await page.getByTestId('generate').click();
  await settle(page, 5000);
  await shot(page, 'x-config-generated');

  step = 'camera';
  await page.getByTestId('camera-boven').click();
  await settle(page, 1200);
  await shot(page, 'x-config-top');
  await page.getByTestId('camera-binnen').click();
  await settle(page, 1200);
  await shot(page, 'x-config-inside');
  await page.getByTestId('camera-laag').click();
  await settle(page, 1200);
  await shot(page, 'x-config-low');
  await page.getByTestId('camera-standaard').click();
  await settle(page, 1200);

  step = 'productdialoog';
  await page.getByTestId('tab-catalogus').click();
  await page.getByTestId('product-concept2-rowerg').getByRole('button', { name: /Details/ }).click();
  await settle(page, 1200);
  await shot(page, 'x-dialog');
  await page.keyboard.press('Escape');

  step = 'ruimtepaneel';
  await page.getByTestId('tab-ruimte').click();
  await settle(page, 300);
  await shot(page, 'x-config-room');

  step = 'labels wisselen';
  await page.getByTestId('view-options').click();
  await page.getByRole('switch', { name: 'Maten en labels' }).click();
  await settle(page, 300);
  await page.getByRole('switch', { name: 'Maten en labels' }).click();
  await shot(page, 'x-config-options');
  await page.getByTestId('view-options').click();

  step = '2D en terug';
  await page.getByTestId('view-2d').click();
  await settle(page, 600);
  await shot(page, 'x-config-2d');
  await page.getByTestId('view-3d').click();
  await settle(page, 800);
  await shot(page, 'x-config-back-3d');

  step = 'bestellijst';
  await addProduct(page, 'bowflex-selecttech-552i');
  await page.getByTestId('topbar-total').click();
  await settle(page, 2000);
  await shot(page, 'x-order');
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' as ScrollBehavior }));
  await settle(page, 300);
  await shot(page, 'x-order-bottom');

  step = 'mobiel';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForTimeout(3000);
  await shot(page, 'x-m-home');
  await page.goto('/configurator');
  await page.waitForFunction(() => !!window.__homegym?.scene()?.floor);
  await settle(page, 1500);
  await shot(page, 'x-m-config');
  await page.getByTestId('nav-catalogus').click();
  await settle(page, 1200);
  await shot(page, 'x-m-sheet');

  step = 'tablet';
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/configurator');
  await page.waitForFunction(() => !!window.__homegym?.scene()?.floor);
  await settle(page, 1500);
  await shot(page, 'x-t-config');
  step = 'klaar';
});
