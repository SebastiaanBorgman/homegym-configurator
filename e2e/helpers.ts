import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export const SHOTS = path.join('test-results', 'screenshots');
mkdirSync(SHOTS, { recursive: true });

export const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

/** Het deel van window.__homegym dat de tests gebruiken. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface PlacedItem {
  id: string;
  productId: string;
  label: string;
  dimensions: { width: number; depth: number; height: number };
  x: number;
  z: number;
  y: number;
  rotationDeg: number;
}
export interface Design {
  name: string;
  room: { width: number; length: number; height: number };
  openings: unknown[];
  obstacles: unknown[];
  items: PlacedItem[];
}
export interface Issue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  itemIds: string[];
  title: string;
  detail: string;
}
export interface SceneInfo {
  floor: { width: number; length: number } | null;
  wallHeights: Record<string, number>;
  items: { id: string; size: Vec3; min: Vec3; max: Vec3 }[];
}

declare global {
  interface Window {
    __homegym: {
      design: () => Design;
      issues: () => Issue[];
      order: () => { totalCents: number; itemCount: number; unpricedCount: number; lines: { productId: string; quantity: number; lineCents: number | null }[] };
      scene: () => SceneInfo | null;
      project: (x: number, y: number, z: number) => { x: number; y: number } | null;
      camera: () => { position: Vec3; target: Vec3 } | null;
      selection: () => { kind: string; id: string } | null;
      capture: () => string | null;
    };
  }
}

export const getDesign = (page: Page) => page.evaluate(() => window.__homegym.design());
export const getIssues = (page: Page) => page.evaluate(() => window.__homegym.issues());
export const getOrder = (page: Page) => page.evaluate(() => window.__homegym.order());
export const getScene = (page: Page) => page.evaluate(() => window.__homegym.scene());
export const getCamera = (page: Page) => page.evaluate(() => window.__homegym.camera());

/** Opent de configurator met een schone lei en wacht tot de 3D-ruimte getekend is. */
export async function openConfigurator(page: Page, { fresh = true } = {}) {
  if (fresh) {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  }
  await page.goto('/configurator');
  await page.waitForFunction(() => !!window.__homegym?.scene()?.floor, undefined, { timeout: 60_000 });
  await settle(page);
}

/** Wacht tot camera-animaties en het opnieuw tekenen klaar zijn. */
export async function settle(page: Page, ms = 900) {
  await page.waitForTimeout(ms);
}

/** Schermpositie van een punt in de ruimte. */
export async function project(page: Page, x: number, y: number, z: number) {
  const p = await page.evaluate(([px, py, pz]) => window.__homegym.project(px, py, pz), [x, y, z]);
  if (!p) throw new Error('3D-scène niet beschikbaar');
  return p;
}

/** Sleept met de muis van het ene punt in de ruimte naar het andere (in kleine stapjes, zoals een mens). */
export async function dragInScene(page: Page, from: [number, number, number], to: [number, number, number], steps = 14) {
  const a = await project(page, ...from);
  const b = await project(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
  }
  await page.mouse.up();
  await page.waitForTimeout(150);
}

export async function addProduct(page: Page, productId: string) {
  await page.getByTestId('tab-catalogus').click();
  await page.getByTestId(`add-${productId}`).click();
  await page.waitForTimeout(250);
}
