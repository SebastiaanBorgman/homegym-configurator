import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PRODUCTS } from '../src/catalog/products';
import {
  addProduct,
  dragInScene,
  getCamera,
  getDesign,
  getIssues,
  getOrder,
  getScene,
  openConfigurator,
  project,
  settle,
  shot,
  type Vec3,
} from './helpers';

/**
 * Verificatie van de draaiende applicatie (productiebuild) in een echte browser.
 * De nummers verwijzen naar de veertien controlepunten uit de opdracht.
 *
 * De tests bedienen de interface zoals een gebruiker dat doet (klikken, typen, slepen met de
 * muis) en lezen daarna de WERKELIJKE toestand terug: het ontwerp in de store, de uitkomst van
 * de ruimtecontrole en de maten van wat er daadwerkelijk in 3D is getekend.
 */

const RACK = 'rogue-rml-390f';
const BENCH = 'rogue-adjustable-bench-3';
const BOX = 'rogue-flat-pack-games-box';
const TREADMILL = 'tunturi-cardio-fit-t60';
const CROSSTRAINER = 'tunturi-cardio-fit-c30';
const SKIERG = 'concept2-skierg-floorstand';
const BOWFLEX = 'bowflex-selecttech-552i';
const INCH = 0.0254;
const MM = 0.001;

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
});

test.afterEach(() => {
  expect(errors, 'geen fouten in de browserconsole').toEqual([]);
});

async function setField(page: Page, testId: string, value: string) {
  const input = page.getByTestId(testId);
  await input.click();
  await input.fill(value);
  await input.press('Enter');
  await page.waitForTimeout(200);
}

async function itemOf(page: Page, productId: string) {
  const design = await getDesign(page);
  const item = design.items.find((i) => i.productId === productId);
  if (!item) throw new Error(`${productId} staat niet in het ontwerp`);
  return item;
}

async function sceneSizeOf(page: Page, itemId: string) {
  const scene = await getScene(page);
  const entry = scene?.items.find((i) => i.id === itemId);
  if (!entry) throw new Error(`apparaat ${itemId} is niet getekend`);
  return entry.size;
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const totalText = (page: Page) => page.getByTestId('topbar-total-amount');

test('1 · de ruimte van 4 × 6 × 2,6 m wordt op ware grootte getekend en is aan te passen', async ({ page }) => {
  await openConfigurator(page);
  const design = await getDesign(page);
  expect(design.room).toMatchObject({ width: 4, length: 6, height: 2.6 });
  expect(design.items).toEqual([]);

  const scene = (await getScene(page))!;
  expect(scene.floor!.width).toBeCloseTo(4, 4);
  expect(scene.floor!.length).toBeCloseTo(6, 4);
  for (const wall of ['north', 'east', 'south', 'west']) expect(scene.wallHeights[wall], wall).toBeCloseTo(2.6, 4);
  await expect(page.getByTestId('room-chip')).toHaveText('4,00 m × 6,00 m');
  await shot(page, '01-lege-ruimte');

  await page.getByTestId('tab-ruimte').click();
  await setField(page, 'room-width', '5,25');
  await setField(page, 'room-length', '7');
  await setField(page, 'room-height', '2,4');
  await settle(page);
  const resized = (await getScene(page))!;
  expect(resized.floor!.width).toBeCloseTo(5.25, 4);
  expect(resized.floor!.length).toBeCloseTo(7, 4);
  for (const wall of ['north', 'east', 'south', 'west']) expect(resized.wallHeights[wall], wall).toBeCloseTo(2.4, 4);
  await expect(page.getByTestId('room-chip')).toHaveText('5,25 m × 7,00 m');
  await shot(page, '01-ruimte-aangepast');
});

test('2 · elk product wordt met exact de catalogusmaten in 3D geplaatst', async ({ page }) => {
  await openConfigurator(page);
  // Een ruime, hoge hal zodat alle 25 producten naast elkaar passen.
  await page.getByTestId('tab-ruimte').click();
  await setField(page, 'room-width', '15');
  await setField(page, 'room-length', '12');
  await setField(page, 'room-height', '3');

  await page.getByTestId('tab-catalogus').click();
  for (const product of PRODUCTS) {
    await page.getByTestId(`add-${product.id}`).click();
  }
  await settle(page, 1500);

  const design = await getDesign(page);
  const scene = (await getScene(page))!;
  expect(design.items).toHaveLength(PRODUCTS.length);
  for (const product of PRODUCTS) {
    const item = design.items.find((i) => i.productId === product.id)!;
    expect(item.dimensions, product.id).toEqual(product.dimensions);
    const drawn = scene.items.find((s) => s.id === item.id)!.size;
    expect(Math.abs(drawn.x - product.dimensions.width), `${product.id} breedte`).toBeLessThan(MM);
    expect(Math.abs(drawn.z - product.dimensions.depth), `${product.id} diepte`).toBeLessThan(MM);
    expect(Math.abs(drawn.y - product.dimensions.height), `${product.id} hoogte`).toBeLessThan(MM);
  }

  // Het rek van 92,25 inch is in 3D ook echt 234,3 cm hoog.
  const rack = design.items.find((i) => i.productId === RACK)!;
  const rackDrawn = scene.items.find((s) => s.id === rack.id)!.size;
  expect(rackDrawn.y).toBeCloseTo(92.25 * INCH, 3);
  expect(rackDrawn.x).toBeCloseTo(48 * INCH, 3);
  expect(rackDrawn.z).toBeCloseTo(49 * INCH, 3);
  await page.getByTestId('camera-standaard').click();
  await settle(page, 1200);
  await shot(page, '02-alle-producten');
});

test('3 · apparaten selecteren, verslepen en draaien met de muis — zonder dat de camera meebeweegt', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, BOX);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__homegym.selection())).toBeNull();

  const box = await itemOf(page, BOX);
  expect(box.x).toBeCloseTo(2, 3);
  expect(box.z).toBeCloseTo(3, 3);

  // Selecteren door in de 3D-weergave op het apparaat te klikken.
  const centre = await project(page, box.x, 0.5, box.z);
  await page.mouse.click(centre.x, centre.y);
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();
  expect((await page.evaluate(() => window.__homegym.selection()))?.id).toBe(box.id);
  await shot(page, '03-geselecteerd');

  // Verslepen: 0,8 m naar rechts en 1,0 m naar voren.
  const cameraBefore = (await getCamera(page))!;
  await dragInScene(page, [2, 0.5, 3], [2.8, 0.5, 4.0]);
  const moved = await itemOf(page, BOX);
  expect(Math.abs(moved.x - 2.8)).toBeLessThan(0.04);
  expect(Math.abs(moved.z - 4.0)).toBeLessThan(0.04);
  const cameraAfter = (await getCamera(page))!;
  expect(distance(cameraBefore.position, cameraAfter.position), 'de camera mag niet bewegen tijdens het slepen').toBeLessThan(1e-6);
  await shot(page, '03-versleept');

  // Draaien met de sneltoets en met de werkbalk.
  await page.keyboard.press('r');
  expect((await itemOf(page, BOX)).rotationDeg).toBe(270);
  await page.getByTestId('tb-rotate-ccw').click();
  expect((await itemOf(page, BOX)).rotationDeg).toBe(0);

  // Draaien door aan de draaigreep te slepen: de voorzijde volgt de muis.
  const now = await itemOf(page, BOX);
  const radius = Math.hypot(now.dimensions.width, now.dimensions.depth) / 2 + 0.2;
  await dragInScene(page, [now.x, 0.03, now.z + radius], [now.x + radius, 0.03, now.z]);
  const turned = await itemOf(page, BOX);
  expect(turned.rotationDeg).toBe(90);
  expect(Math.abs(turned.x - now.x)).toBeLessThan(1e-6); // alleen gedraaid, niet verplaatst
  await shot(page, '03-gedraaid');

  // Ongedaan maken herstelt de vorige stand.
  await page.getByTestId('undo').click();
  expect((await itemOf(page, BOX)).rotationDeg).toBe(0);
});

test('4 · gedraaide apparaten behouden hun werkelijke afmetingen', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, RACK);
  const w = 48 * INCH;
  const d = 49 * INCH;
  const h = 92.25 * INCH;

  await setField(page, 'item-rotation', '90');
  const quarter = await sceneSizeOf(page, (await itemOf(page, RACK)).id);
  expect(quarter.x).toBeCloseTo(d, 3); // breedte en diepte wisselen van as
  expect(quarter.z).toBeCloseTo(w, 3);
  expect(quarter.y).toBeCloseTo(h, 3);

  await setField(page, 'item-rotation', '30');
  const rack = await itemOf(page, RACK);
  expect(rack.rotationDeg).toBe(30);
  expect(rack.dimensions).toEqual({ width: w, depth: d, height: h });
  const skewed = await sceneSizeOf(page, rack.id);
  const rad = (30 * Math.PI) / 180;
  // De omhullende van een schuin staand rek volgt uit de échte breedte en diepte.
  expect(skewed.x).toBeCloseTo(w * Math.cos(rad) + d * Math.sin(rad), 2);
  expect(skewed.z).toBeCloseTo(w * Math.sin(rad) + d * Math.cos(rad), 2);
  expect(skewed.y).toBeCloseTo(h, 3);
  await expect(page.getByTestId('inspector-dims')).toHaveText('121,9 × 124,5 × 234,3 cm');
  await shot(page, '04-gedraaid-rek');
});

test('5 · een apparaat dat door een muur steekt geeft een waarschuwing; tegen de muur klikt het vast', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, BOX);
  const half = (30 * INCH) / 2;

  // Slepen tot vlak bij de linkerwand: het apparaat klikt er precies tegenaan.
  await dragInScene(page, [2, 0.5, 3], [half + 0.06, 0.5, 3]);
  const snapped = await itemOf(page, BOX);
  expect(snapped.x).toBeCloseTo(half, 3);
  expect(await getIssues(page)).toEqual([]);

  // Verder slepen, dwars door de muur heen.
  await dragInScene(page, [snapped.x, 0.5, 3], [-0.25, 0.5, 3]);
  const outside = await itemOf(page, BOX);
  expect(outside.x).toBeLessThan(0);
  const issues = await getIssues(page);
  expect(issues.map((i) => i.code)).toContain('OUT_OF_ROOM');
  await expect(page.getByTestId('checks-summary')).toHaveAttribute('data-errors', '1');
  await expect(page.getByTestId('issue-OUT_OF_ROOM')).toContainText('staat buiten de ruimte');
  await expect(page.getByTestId('issue-OUT_OF_ROOM')).toContainText('linkerwand');
  await expect(page.getByTestId('status-chip')).toContainText('1 past niet');
  await shot(page, '05-door-de-muur');

  // Terugzetten via de knop "tegen de muur": melding verdwijnt.
  await page.getByTestId('to-wall-west').click();
  expect(await getIssues(page)).toEqual([]);
  await expect(page.getByTestId('status-chip')).toContainText('Alles past');
});

test('6 · overlappende apparatuur wordt herkend, ook bij gedraaide apparaten', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, TREADMILL);
  await setField(page, 'item-x', '150');
  await setField(page, 'item-z', '300');
  await addProduct(page, CROSSTRAINER);
  await setField(page, 'item-x', '190');
  await setField(page, 'item-z', '300');

  let overlaps = (await getIssues(page)).filter((i) => i.code === 'OVERLAP');
  expect(overlaps).toHaveLength(1);
  expect(overlaps[0].severity).toBe('error');
  await expect(page.getByTestId('issue-OVERLAP')).toContainText('overlappen');
  await shot(page, '06-overlap');

  // Precies tegen elkaar aan (83,5/2 + 60/2 = 71,75 cm uit elkaar) is géén overlap.
  await setField(page, 'item-x', '221,75');
  expect((await getIssues(page)).filter((i) => i.code === 'OVERLAP')).toEqual([]);

  // Beide 45° gedraaid en evenwijdig naast elkaar: de omhullende rechthoeken overlappen, de toestellen niet.
  await setField(page, 'item-rotation', '45');
  await setField(page, 'item-x', '263,6');
  await setField(page, 'item-z', '236,4');
  await page.getByTestId('tab-indeling').click(); // de lijst met geplaatste apparaten
  await page.getByTestId('placed-item').first().click();
  await setField(page, 'item-x', '200');
  await setField(page, 'item-rotation', '45');
  expect((await getIssues(page)).filter((i) => i.code === 'OVERLAP')).toEqual([]);

  // Schuif de crosstrainer 30 cm dichterbij: nu snijden de gedraaide toestellen elkaar wel.
  await page.getByTestId('placed-item').nth(1).click();
  await setField(page, 'item-x', '242,4');
  await setField(page, 'item-z', '257,6');
  overlaps = (await getIssues(page)).filter((i) => i.code === 'OVERLAP');
  expect(overlaps).toHaveLength(1);
  await shot(page, '06-overlap-gedraaid');
});

test('7 · een apparaat dat te hoog is voor het plafond wordt herkend', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, RACK);
  await addProduct(page, SKIERG);
  expect((await getIssues(page)).filter((i) => i.code === 'CEILING')).toEqual([]);

  await page.getByTestId('tab-ruimte').click();
  await setField(page, 'room-height', '2,2');
  const ceiling = (await getIssues(page)).filter((i) => i.code === 'CEILING');
  expect(ceiling).toHaveLength(1); // het rek (234,3 cm) past niet, de SkiErg (215,9 cm) wel
  expect(ceiling[0].itemIds).toEqual([(await itemOf(page, RACK)).id]);
  expect(ceiling[0].detail).toContain('14,3 cm te hoog');
  await expect(page.getByTestId('issue-CEILING')).toContainText('te hoog');
  await shot(page, '07-te-hoog');

  await setField(page, 'room-height', '2,1');
  expect((await getIssues(page)).filter((i) => i.code === 'CEILING')).toHaveLength(2);

  await setField(page, 'room-height', '2,6');
  expect((await getIssues(page)).filter((i) => i.code === 'CEILING')).toEqual([]);
});

test('8 · de camera kan vrij rond de ruimte bewegen en keert terug naar de standaardstand', async ({ page }) => {
  await openConfigurator(page);
  const start = (await getCamera(page))!;
  const main = (await page.locator('main').boundingBox())!;
  const empty = { x: main.x + main.width - 90, y: main.y + main.height * 0.45 };

  // Draaien: slepen op een lege plek.
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  await page.mouse.move(empty.x - 260, empty.y + 40, { steps: 12 });
  await page.mouse.up();
  await settle(page, 700);
  const orbited = (await getCamera(page))!;
  expect(distance(start.position, orbited.position)).toBeGreaterThan(1);
  expect(distance(start.target, orbited.target)).toBeLessThan(0.01);
  expect(distance(orbited.position, orbited.target)).toBeCloseTo(distance(start.position, start.target), 1);
  await shot(page, '08-gedraaid');

  // Zoomen met het muiswiel.
  await page.mouse.move(main.x + main.width / 2, main.y + main.height / 2);
  await page.mouse.wheel(0, -600);
  await settle(page, 700);
  const zoomed = (await getCamera(page))!;
  expect(distance(zoomed.position, zoomed.target)).toBeLessThan(distance(orbited.position, orbited.target) - 0.5);

  // Schuiven met de rechtermuisknop.
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(empty.x - 150, empty.y - 60, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await settle(page, 700);
  const panned = (await getCamera(page))!;
  expect(distance(zoomed.target, panned.target)).toBeGreaterThan(0.3);

  // Van bovenaf.
  await page.getByTestId('camera-boven').click();
  await settle(page, 1200);
  const top = (await getCamera(page))!;
  expect(top.position.y).toBeGreaterThan(9);
  expect(Math.hypot(top.position.x - 2, top.position.z - 3)).toBeLessThan(0.1);
  await shot(page, '08-bovenaanzicht');

  // Laag standpunt.
  await page.getByTestId('camera-laag').click();
  await settle(page, 1200);
  const low = (await getCamera(page))!;
  expect(low.position.y).toBeLessThan(3.5);
  await shot(page, '08-laag-standpunt');

  // Op ooghoogte in de ruimte.
  await page.getByTestId('camera-binnen').click();
  await settle(page, 1200);
  const inside = (await getCamera(page))!;
  expect(inside.position.x).toBeGreaterThan(0);
  expect(inside.position.x).toBeLessThan(4);
  expect(inside.position.z).toBeLessThan(6);
  expect(inside.position.y).toBeCloseTo(1.65, 2);
  await shot(page, '08-ooghoogte');

  // Terug naar de standaardcamera.
  await page.getByTestId('camera-standaard').click();
  await settle(page, 1200);
  const back = (await getCamera(page))!;
  expect(distance(back.position, start.position)).toBeLessThan(0.02);
  expect(distance(back.target, start.target)).toBeLessThan(0.02);
});

test('9 + 10 · producten toevoegen vanuit de catalogus; de totaalprijs rekent correct mee', async ({ page }) => {
  await openConfigurator(page);
  await expect(totalText(page)).toHaveText('€ 0');

  // Zoeken en filteren.
  await page.getByTestId('catalog-search').fill('loopband');
  await expect(page.getByTestId('catalog-count')).toHaveText('1 product');
  await expect(page.getByTestId(`product-${TREADMILL}`)).toBeVisible();
  await page.getByTestId('catalog-search').fill('');
  await page.getByTestId('category-banken').click();
  await expect(page.getByTestId('catalog-count')).toContainText('2 producten');
  await page.getByTestId('category-alle').click();

  // Toevoegen met de plusknop.
  await addProduct(page, RACK);
  await expect(totalText(page)).toHaveText('€ 1.115');
  expect((await getOrder(page)).totalCents).toBe(111500);

  // Toevoegen via het detailvenster, met maten en bron in beeld.
  await page.getByTestId(`product-${BENCH}`).getByRole('button', { name: /Details/ }).click();
  const dialog = page.getByTestId('product-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('product-dimensions')).toContainText('62,9');
  await expect(dialog.getByTestId('product-dimensions')).toContainText('143,5');
  await expect(dialog.getByTestId('product-dimensions')).toContainText('44,5');
  await expect(dialog).toContainText('Afmetingen geverifieerd');
  await expect(dialog.getByRole('link', { name: /Productpagina Rogue Fitness/ })).toHaveAttribute('href', /roguefitness\.com/);
  await shot(page, '09-productvenster');
  await dialog.getByTestId('dialog-add').click();
  await expect(totalText(page)).toHaveText('€ 1.877,30');

  // Tweede bank erbij: aantal en regeltotaal kloppen.
  await addProduct(page, BENCH);
  await expect(totalText(page)).toHaveText('€ 2.639,60');
  await page.getByTestId('tab-bestellijst').click();
  await expect(page.getByTestId(`order-qty-${BENCH}`)).toHaveText('2');
  await expect(page.getByTestId(`order-total-${BENCH}`)).toHaveText('€ 1.524,60');
  await expect(page.getByTestId('order-total')).toHaveText('€ 2.639,60');
  expect((await getDesign(page)).items).toHaveLength(3);
  await shot(page, '10-bestellijst');

  // Eén bank minder, daarna het rek uit de lijst verwijderen.
  await page.getByTestId(`order-minus-${BENCH}`).click();
  await expect(totalText(page)).toHaveText('€ 1.877,30');
  await page.getByTestId(`order-remove-${RACK}`).click();
  await expect(totalText(page)).toHaveText('€ 762,30');
  expect((await getOrder(page)).totalCents).toBe(76230);
  expect((await getDesign(page)).items.map((i) => i.productId)).toEqual([BENCH]);

  // Een product zonder betrouwbare prijs telt niet mee en wordt gemeld.
  await addProduct(page, BOWFLEX);
  await expect(totalText(page)).toHaveText('€ 762,30');
  await expect(page.getByTestId('unpriced-note')).toContainText('1 product heeft geen bekende prijs');
  await expect(page.getByTestId(`product-${BOWFLEX}`)).toContainText('Niet geverifieerd');

  // Het besteloverzicht toont dezelfde regels met echte leverancierslinks.
  await page.getByTestId('open-order-page').click();
  await expect(page.getByTestId('order-page-total')).toHaveText('€ 762,30');
  await expect(page.getByTestId(`order-link-${BENCH}`)).toHaveAttribute('href', 'https://www.roguefitness.com/nl/en/rogue-adjustable-bench-3-0-eu');
  await expect(page.getByTestId(`order-row-${BOWFLEX}`)).toContainText('prijs onbekend');
  await shot(page, '10-besteloverzicht');
});

test('11 · een ontwerp blijft bewaard na het verversen van de pagina', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, RACK);
  await setField(page, 'item-x', '134,5');
  await setField(page, 'item-z', '62,3');
  await addProduct(page, BENCH);
  await setField(page, 'item-rotation', '37,5');
  await page.getByTestId('tab-ruimte').click();
  await setField(page, 'room-width', '4,4');
  await page.getByTestId('design-name').fill('Garage van test');
  await page.waitForTimeout(500); // automatisch opslaan

  const before = await getDesign(page);
  await page.reload();
  await page.waitForFunction(() => !!window.__homegym?.scene()?.floor);
  const after = await getDesign(page);

  expect(after.name).toBe('Garage van test');
  expect(after.room).toEqual(before.room);
  expect(after.items).toEqual(before.items);
  expect(after.openings).toEqual(before.openings);
  expect(after.items[0]).toMatchObject({ productId: RACK, x: 1.345, z: 0.623 });
  expect(after.items[1]).toMatchObject({ productId: BENCH, rotationDeg: 37.5 });
  await expect(totalText(page)).toHaveText('€ 1.877,30');
  await settle(page);
  expect((await getScene(page))!.items).toHaveLength(2);
  await shot(page, '11-na-verversen');
});

test('12 · een geëxporteerd ontwerp kan opnieuw worden geïmporteerd', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, RACK);
  await setField(page, 'item-x', '200');
  await setField(page, 'item-z', '62,3');
  await addProduct(page, BOX);
  await setField(page, 'item-rotation', '45');
  await page.getByTestId('tab-ruimte').click();
  await page.getByTestId('add-obstacle').click();
  const original = await getDesign(page);

  await page.getByTestId('menu-button').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^homegym-.*\.json$/);
  const file = await download.path();
  const exported = JSON.parse(readFileSync(file, 'utf8'));

  // Het bestand bevat maten, coördinaten en rotaties — niet alleen productnamen.
  expect(exported.format).toBe('homegym-ontwerp');
  expect(exported.eenheden).toEqual({ lengte: 'meter', rotatie: 'graden' });
  const rack = exported.design.items[0];
  expect(rack.dimensions.height).toBeCloseTo(92.25 * INCH, 6);
  expect(rack).toMatchObject({ productId: RACK, x: 2, z: 0.623, rotationDeg: 0 });
  expect(rack.product).toMatchObject({ brand: 'Rogue', priceEur: 1115 });
  expect(exported.design.items[1].rotationDeg).toBe(45);

  // Nieuw, leeg ontwerp starten en het bestand weer inlezen.
  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu-new').click();
  expect((await getDesign(page)).items).toEqual([]);
  await page.getByTestId('import-input').setInputFiles(file);
  await page.waitForFunction(() => window.__homegym.design().items.length === 2);

  const restored = await getDesign(page);
  expect(restored.room).toEqual(original.room);
  expect(restored.items).toEqual(original.items);
  expect(restored.obstacles).toEqual(original.obstacles);
  expect(restored.openings).toEqual(original.openings);
  await settle(page, 1200);
  expect((await getScene(page))!.items).toHaveLength(2);
  await shot(page, '12-geimporteerd');

  // Een ongeldig bestand wordt netjes geweigerd en laat het ontwerp intact.
  await page.getByTestId('import-input').setInputFiles({ name: 'kapot.json', mimeType: 'application/json', buffer: Buffer.from('{ dit is geen json') });
  await expect(page.getByText('Importeren mislukt')).toBeVisible();
  expect((await getDesign(page)).items).toHaveLength(2);
});

test('13 · de productiebuild werkt: homepage, configurator en besteloverzicht', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // We testen de gebouwde bestanden, niet de ontwikkelserver.
  expect(await page.locator('script[type="module"][src^="/assets/"]').count()).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ontwerp je eigen homegym');
  await expect(page.getByTestId('hero-cta')).toHaveText(/Ontwerp je eigen homegym/);
  await expect(page.getByTestId('status-legend')).toContainText('geverifieerd');
  await expect(page.getByTestId('examples').locator('li')).toHaveCount(3);
  await page.waitForTimeout(2500);
  await shot(page, '13-homepage');

  // De hoofdactie opent de configurator met de lege voorbeeldruimte.
  await page.getByTestId('hero-cta').click();
  await page.waitForFunction(() => !!window.__homegym?.scene()?.floor);
  expect((await getDesign(page)).room).toMatchObject({ width: 4, length: 6, height: 2.6 });
  await expect(page.getByTestId('empty-hint')).toBeVisible();

  // Een voorbeeld van de homepage openen laadt een complete, passende gym.
  await page.goto('/');
  await page.getByTestId('open-example-garage-kracht').click();
  await page.waitForFunction(() => window.__homegym?.design().items.length > 0 && !!window.__homegym.scene()?.floor);
  const design = await getDesign(page);
  expect(design.room).toMatchObject({ width: 3, length: 6 });
  expect((await getIssues(page)).filter((i) => i.severity !== 'info')).toEqual([]);
  await settle(page, 1500);
  await shot(page, '13-voorbeeld-geopend');

  await page.getByTestId('topbar-total').click();
  await expect(page.getByTestId('order-title')).toHaveText('De garagegym');
  await expect(page.getByTestId('supplier-rogue')).toBeVisible();

  // Een onbekende route geeft een nette pagina in plaats van een fout.
  await page.goto('/bestaat-niet');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deze pagina bestaat niet.');
});

test('14 · de 3D-weergave tekent een gevuld beeld zonder fouten', async ({ page }) => {
  await openConfigurator(page);
  await page.getByTestId('tab-indeling').click();
  await page.getByTestId('profile-kracht').click();
  await page.getByTestId('generate').click();
  await settle(page, 1500);

  // Lees het werkelijk getekende beeld uit en tel hoeveel ervan gevuld is.
  const stats = await page.evaluate(async () => {
    const url = window.__homegym.capture();
    if (!url) return null;
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = Math.round((320 * img.height) / img.width);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let filled = 0;
    let dark = 0;
    const colours = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) {
        filled += 1;
        if (data[i] + data[i + 1] + data[i + 2] < 150) dark += 1;
        colours.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4));
      }
    }
    return { width: img.width, height: img.height, filled: filled / (data.length / 4), dark: dark / (data.length / 4), colours: colours.size };
  });
  expect(stats).not.toBeNull();
  expect(stats!.width).toBeGreaterThan(400);
  expect(stats!.filled, 'de ruimte vult een flink deel van het beeld').toBeGreaterThan(0.12);
  expect(stats!.dark, 'donkere vloer en toestellen zijn zichtbaar').toBeGreaterThan(0.03);
  expect(stats!.colours, 'het beeld bevat veel verschillende tinten').toBeGreaterThan(40);
  await shot(page, '14-3d-weergave');
});

test('indeling genereren: een voorstel zonder fouten of waarschuwingen, daarna vrij aan te passen', async ({ page }) => {
  await openConfigurator(page);
  await page.getByTestId('tab-ruimte').click();
  await page.getByTestId('add-obstacle').click();
  const pillar = (await getDesign(page)).obstacles as { x: number; z: number }[];
  expect(pillar).toHaveLength(1);

  await page.getByTestId('tab-indeling').click();
  await page.getByTestId('profile-compleet').click();
  await page.getByTestId('generate').click();
  await settle(page, 1500);

  const design = await getDesign(page);
  expect(design.items.length).toBeGreaterThanOrEqual(5);
  const issues = await getIssues(page);
  expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  expect(issues.filter((i) => i.severity === 'warning')).toEqual([]);
  // Alles staat binnen de muren en onder het plafond.
  for (const drawn of (await getScene(page))!.items) {
    expect(drawn.min.x).toBeGreaterThanOrEqual(-0.001);
    expect(drawn.max.x).toBeLessThanOrEqual(4.001);
    expect(drawn.min.z).toBeGreaterThanOrEqual(-0.001);
    expect(drawn.max.z).toBeLessThanOrEqual(6.001);
    expect(drawn.max.y).toBeLessThanOrEqual(2.601);
  }
  await expect(page.getByTestId('placed-list').locator('li')).toHaveCount(design.items.length);
  await shot(page, '15-gegenereerd');

  // Opnieuw genereren vraagt eerst om bevestiging en geeft daarna een nieuw voorstel.
  await page.getByTestId('generate').click();
  await page.getByTestId('generate-confirm').click();
  await settle(page, 800);
  expect((await getIssues(page)).filter((i) => i.severity === 'error')).toEqual([]);

  // Het voorstel is gewoon aanpasbaar: een apparaat dupliceren en weer verwijderen.
  const count = (await getDesign(page)).items.length;
  await page.getByTestId('placed-item').first().click();
  await page.getByTestId('duplicate').click();
  expect((await getDesign(page)).items).toHaveLength(count + 1);
  await page.keyboard.press('Delete');
  expect((await getDesign(page)).items).toHaveLength(count);
});

test('2D-plattegrond en 3D tonen hetzelfde ontwerp; slepen in 2D verplaatst het apparaat ook in 3D', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, TREADMILL);
  await page.getByTestId('view-2d').click();
  await expect(page.getByTestId('plan-view')).toBeVisible();
  await expect(page.getByTestId('plan-width')).toHaveText('4,00 m');
  await expect(page.getByTestId('plan-length')).toHaveText('6,00 m');

  const shape = page.getByTestId(`plan-item-${TREADMILL}`);
  await expect(shape).toHaveCount(1);
  const before = await itemOf(page, TREADMILL);
  const box = (await shape.boundingBox())!;
  // Schaal van de plattegrond: het toestel is 170,1 cm lang.
  const pxPerMeter = box.height / before.dimensions.depth;
  expect(box.width / pxPerMeter).toBeCloseTo(before.dimensions.width, 1);

  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 0.9 * pxPerMeter, from.y - 1.1 * pxPerMeter, { steps: 12 });
  await page.mouse.up();
  const after = await itemOf(page, TREADMILL);
  expect(after.x - before.x).toBeCloseTo(0.9, 1);
  expect(after.z - before.z).toBeCloseTo(-1.1, 1);
  await shot(page, '16-plattegrond');

  // Terug in 3D staat het toestel op exact dezelfde plek.
  await page.getByTestId('view-3d').click();
  await settle(page, 800);
  const drawn = (await getScene(page))!.items.find((i) => i.id === after.id)!;
  expect((drawn.min.x + drawn.max.x) / 2).toBeCloseTo(after.x, 3);
  expect((drawn.min.z + drawn.max.z) / 2).toBeCloseTo(after.z, 3);
});

test('obstakels, deuren en een afbeelding van het ontwerp', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, TREADMILL);
  const treadmill = await itemOf(page, TREADMILL);

  // Een pilaar op de plek van de loopband geeft een fout.
  await page.getByTestId('tab-ruimte').click();
  await page.getByTestId('add-obstacle').click();
  const row = page.getByTestId('obstacle-row');
  await row.getByLabel('X').fill(String(Math.round(treadmill.x * 100)));
  await row.getByLabel('X').press('Enter');
  await row.getByLabel('Z').fill(String(Math.round(treadmill.z * 100)));
  await row.getByLabel('Z').press('Enter');
  expect((await getIssues(page)).map((i) => i.code)).toContain('OBSTACLE');
  await shot(page, '17-obstakel');
  await row.getByRole('button', { name: 'Obstakel verwijderen' }).click();
  expect((await getIssues(page)).map((i) => i.code)).not.toContain('OBSTACLE');

  // Een deur en een raam toevoegen; een toestel in het draaibereik van de deur geeft een waarschuwing.
  const openingsBefore = (await getDesign(page)).openings.length;
  await page.getByTestId('add-door').click();
  await page.getByTestId('add-window').click();
  expect((await getDesign(page)).openings).toHaveLength(openingsBefore + 2);
  await page.getByTestId('tab-indeling').click();
  await page.getByTestId('placed-item').first().click();
  await page.getByTestId('to-wall-west').click(); // tegen de linkerwand
  await setField(page, 'item-z', '500'); // vóór de deur van de voorbeeldruimte
  const doorIssues = (await getIssues(page)).filter((i) => i.code === 'DOOR');
  expect(doorIssues).toHaveLength(1);
  expect(doorIssues[0].severity).toBe('warning');

  // Afbeelding van het 3D-ontwerp exporteren.
  await page.getByTestId('menu-button').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-image').click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const png = readFileSync(await download.path());
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(30_000);
});

test.describe('aanraakbediening', () => {
  test.use({ viewport: { width: 820, height: 1100 }, hasTouch: true });

  test('met één vinger een apparaat verslepen beweegt de camera niet; op een lege plek draait de camera', async ({ page }) => {
    await openConfigurator(page);
    await page.getByTestId('nav-catalogus').click();
    await page.getByTestId(`add-${BOX}`).click();
    await settle(page, 600);
    const before = await itemOf(page, BOX);
    const cdp = await page.context().newCDPSession(page);
    const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x: Math.round(x), y: Math.round(y!) }] });

    // Vinger op het apparaat en slepen.
    const a = await project(page, before.x, 0.5, before.z);
    const b = await project(page, before.x + 0.7, 0.5, before.z + 0.9);
    const cameraBefore = (await getCamera(page))!;
    await touch('touchStart', a.x, a.y);
    for (let i = 1; i <= 10; i++) await touch('touchMove', a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
    await touch('touchEnd');
    await settle(page, 400);
    const after = await itemOf(page, BOX);
    expect(Math.abs(after.x - (before.x + 0.7))).toBeLessThan(0.06);
    expect(Math.abs(after.z - (before.z + 0.9))).toBeLessThan(0.06);
    expect(distance(cameraBefore.position, (await getCamera(page))!.position)).toBeLessThan(1e-6);

    // Vinger op een lege plek: de camera draait, het apparaat blijft staan.
    const main = (await page.locator('main').boundingBox())!;
    const start = { x: main.x + main.width - 60, y: main.y + main.height * 0.3 };
    await touch('touchStart', start.x, start.y);
    for (let i = 1; i <= 10; i++) await touch('touchMove', start.x - i * 22, start.y);
    await touch('touchEnd');
    await settle(page, 700);
    expect(distance(cameraBefore.position, (await getCamera(page))!.position)).toBeGreaterThan(0.5);
    expect((await itemOf(page, BOX)).x).toBe(after.x);
    await shot(page, '18-aanraakbediening');
  });
});

test('sneltoetsen, type ruimte en een afbeelding van de plattegrond', async ({ page }) => {
  await openConfigurator(page);
  await addProduct(page, BOX);
  const start = await itemOf(page, BOX);

  // Draaien in stappen van 15° en verschuiven per centimeter.
  await page.keyboard.press('q');
  expect((await itemOf(page, BOX)).rotationDeg).toBe(15);
  await page.keyboard.press('e');
  expect((await itemOf(page, BOX)).rotationDeg).toBe(0);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const nudged = await itemOf(page, BOX);
  expect(nudged.x).toBeCloseTo(start.x + 0.01, 6);
  expect(nudged.z).toBeCloseTo(start.z + 0.1, 6);

  // Dupliceren en ongedaan maken.
  await page.keyboard.press('Control+d');
  expect((await getDesign(page)).items).toHaveLength(2);
  expect(await getIssues(page)).toEqual([]); // de kopie staat ernaast, niet erin
  await page.keyboard.press('Control+z');
  expect((await getDesign(page)).items).toHaveLength(1);
  await page.keyboard.press('Control+y');
  expect((await getDesign(page)).items).toHaveLength(2);
  await page.keyboard.press('Control+z');

  // Tegen de dichtstbijzijnde muur.
  const centre = await project(page, nudged.x, 0.5, nudged.z);
  await page.mouse.click(centre.x, centre.y);
  await page.keyboard.press('w');
  const atWall = await itemOf(page, BOX);
  // Met de rug tegen de muur: het midden staat precies een halve diepte van die muur af.
  const toWalls = [atWall.x, 4 - atWall.x, atWall.z, 6 - atWall.z];
  expect(Math.min(...toWalls)).toBeCloseTo(atWall.dimensions.depth / 2, 3);
  expect(await getIssues(page)).toEqual([]);

  // Een type ruimte kiezen vervangt maten, deuren en ramen; het apparaat blijft staan.
  await page.getByTestId('tab-ruimte').click();
  await page.getByTestId('preset-garage').click();
  const garage = await getDesign(page);
  expect(garage.room).toMatchObject({ width: 3, length: 6, height: 2.4, floor: 'beton' });
  expect(garage.openings).toHaveLength(2);
  expect(garage.items).toHaveLength(1);
  await settle(page, 1200);
  const scene = (await getScene(page))!;
  expect(scene.floor!.width).toBeCloseTo(3, 4);
  expect(scene.wallHeights.north).toBeCloseTo(2.4, 4);
  await shot(page, '19-garage');

  // Afbeelding exporteren vanuit de 2D-plattegrond.
  await page.getByTestId('view-2d').click();
  await expect(page.getByTestId('plan-view')).toBeVisible();
  await page.getByTestId('menu-button').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('menu-image').click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const png = readFileSync(await download.path());
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(15_000);
  await expect(page.getByText('Afbeelding opgeslagen')).toBeVisible();
});
