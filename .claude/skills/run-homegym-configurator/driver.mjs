#!/usr/bin/env node
// Drives a RUNNING Homegym Studio server in headless system Chrome and reports what the app
// actually did (via the window.__homegym debug hook) plus screenshots.
//
//   node .claude/skills/run-homegym-configurator/driver.mjs [--base URL] [--out DIR]
//        [--products id1,id2,...] [--flow full|home|configurator|order] [--headed]
//
// Flow "full" (default): homepage -> fresh configurator -> add products via catalogue UI ->
// 2D plan -> reload (persistence) -> /bestellijst order page. Exit code 1 on any failure or
// any browser console error.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const base = (args.base || 'http://localhost:5173').replace(/\/$/, '');
const out = path.resolve(args.out || 'test-results/run-skill');
const flow = args.flow || 'full';
mkdirSync(out, { recursive: true });

const log = (...m) => console.log('[driver]', ...m);
const errors = [];
let n = 0;

const browser = await chromium.launch({
  channel: 'chrome', // system Chrome; no Playwright browser download needed
  headless: !args.headed,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], // WebGL without a GPU
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'nl-NL' });
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = async (name) => {
  const file = path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  log('screenshot', file);
};
const hg = (fn, arg) => page.evaluate(fn, arg);
const waitForScene = () =>
  page.waitForFunction(() => !!window.__homegym?.scene()?.floor, undefined, { timeout: 60_000 });

async function home() {
  await page.goto(base + '/');
  await page.getByTestId('hero-scene').waitFor();
  await page.waitForTimeout(2500); // let the rotating 3D hero render a few frames
  log('home title:', await page.title());
  await shot('home');
}

async function configurator() {
  await page.goto(base + '/');
  await hg(() => localStorage.clear()); // fresh design; otherwise the autosaved one is restored
  await page.goto(base + '/configurator');
  await waitForScene();
  await page.waitForTimeout(1000);
  log('room:', JSON.stringify(await hg(() => window.__homegym.design().room)));
  await shot('configurator-empty');

  await page.getByTestId('tab-catalogus').click();
  // Scope to product cards: the Ruimte tab also has add-door/add-window/add-obstacle test ids.
  const all = await page
    .locator('[data-testid^="product-"] [data-testid^="add-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').slice(4)));
  log('catalogue products:', all.length);
  const ids = args.products ? String(args.products).split(',') : all.slice(0, 3);
  const unknown = ids.filter((id) => !all.includes(id));
  if (unknown.length) throw new Error(`unknown product id(s): ${unknown.join(', ')}. Valid: ${all.join(', ')}`);
  for (const id of ids) {
    await page.getByTestId(`add-${id}`).click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1000);

  const design = await hg(() => window.__homegym.design());
  const scene = await hg(() => window.__homegym.scene());
  const order = await hg(() => window.__homegym.order());
  const issues = await hg(() => window.__homegym.issues());
  for (const i of design.items) log(`  item ${i.label} @ x=${i.x.toFixed(2)} z=${i.z.toFixed(2)} rot=${i.rotationDeg}`);
  log('items in store:', design.items.length, '| drawn in 3D:', scene.items.length);
  log(`order: ${order.itemCount} items, EUR ${(order.totalCents / 100).toFixed(2)}, unpriced ${order.unpricedCount}`);
  log('issues:', issues.length ? issues.map((i) => `${i.severity}:${i.title}`).join(' | ') : 'none');
  if (scene.items.length !== ids.length) throw new Error(`expected ${ids.length} items in 3D, got ${scene.items.length}`);
  await shot('configurator-items');

  await page.getByTestId('view-2d').click();
  await page.getByTestId('plan-view').waitFor();
  await page.waitForTimeout(500);
  await shot('plan-2d');
  await page.getByText('3D', { exact: true }).click();

  await page.reload();
  await waitForScene();
  const after = (await hg(() => window.__homegym.design())).items.length;
  log('items after reload:', after);
  if (after !== ids.length) throw new Error('design not restored after reload');
}

async function orderPage() {
  await page.goto(base + '/bestellijst');
  await page.getByTestId('order-title').waitFor();
  const total = page.getByTestId('order-page-total');
  log('order page total:', (await total.count()) ? (await total.innerText()).trim() : '(empty order)');
  await shot('order-page');
}

try {
  if (flow === 'home' || flow === 'full') await home();
  if (flow === 'configurator' || flow === 'full') await configurator();
  if (flow === 'order' || flow === 'full') await orderPage();
} catch (e) {
  errors.push(`driver: ${e.message}`);
  await shot('failure').catch(() => {});
}
await browser.close();
log('errors:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
process.exit(errors.length ? 1 : 0);
