import { describe, expect, it } from 'vitest';
import { LAYOUT_PROFILES, layoutProductsFor, specOf } from '../../catalog';
import { ROOM_PRESETS, designFromPreset } from '../defaults';
import { validateDesign } from '../geometry/validation';
import type { Design, Obstacle } from '../types';
import { createRng, generateLayout } from './autoLayout';

function designWith(base: Design, profileId: string, seed = 1, obstacles: Obstacle[] = []) {
  const result = generateLayout({
    room: base.room,
    openings: base.openings,
    obstacles,
    products: layoutProductsFor(profileId),
    seed,
    attempts: 4,
  });
  const design: Design = { ...base, obstacles, items: result.items };
  return { result, design, issues: validateDesign(design, specOf) };
}

describe('indelingsgenerator', () => {
  it('is deterministisch: zelfde seed geeft dezelfde indeling', () => {
    const base = designFromPreset(ROOM_PRESETS[0]);
    const a = designWith(base, 'kracht', 7).result;
    const b = designWith(base, 'kracht', 7).result;
    expect(a.items).toEqual(b.items);
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    expect([rng1(), rng1(), rng1()]).toEqual([rng2(), rng2(), rng2()]);
  });

  it('levert voor elk profiel en elke voorbeeldruimte een indeling zonder fouten', () => {
    for (const preset of ROOM_PRESETS) {
      for (const profile of LAYOUT_PROFILES) {
        const { result, issues } = designWith(designFromPreset(preset), profile.id, 3);
        const errors = issues.filter((i) => i.severity === 'error');
        expect(errors, `${preset.id}/${profile.id}: ${errors.map((e) => e.title).join('; ')}`).toEqual([]);
        // De generator stelt niets voor dat zijn eigen ruimtecontrole niet doorstaat.
        const warnings = issues.filter((i) => i.severity === 'warning');
        expect(warnings, `${preset.id}/${profile.id}: ${warnings.map((w) => w.title).join('; ')}`).toEqual([]);
        expect(result.items.length + result.skipped.length).toBe(profile.productIds.length);
        expect(result.items.length, `${preset.id}/${profile.id} plaatst niets`).toBeGreaterThan(0);
      }
    }
  });

  it('plaatst in de voorbeeldruimte van 4 × 6 m het rek met bank en stang', () => {
    const { result, issues } = designWith(designFromPreset(ROOM_PRESETS[0]), 'kracht', 1);
    const ids = result.items.map((i) => i.productId);
    expect(ids).toContain('rogue-rml-390f');
    expect(ids).toContain('rogue-adjustable-bench-3');
    expect(ids).toContain('rogue-ohio-bar');
    // De stang ligt op de J-cups: verhoogd en dus alleen een aandachtspunt, geen fout.
    const bar = result.items.find((i) => i.productId === 'rogue-ohio-bar')!;
    expect(bar.y).toBeGreaterThan(1);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(issues.filter((i) => i.code === 'DOOR')).toEqual([]);
  });

  it('houdt rekening met obstakels', () => {
    const base = designFromPreset(ROOM_PRESETS[0]);
    const pillars: Obstacle[] = [
      { id: 'o1', name: 'Pilaar', x: 2, z: 0.4, width: 0.4, depth: 0.4, height: 2.6, rotationDeg: 0 },
      { id: 'o2', name: 'Pilaar', x: 3.8, z: 3, width: 0.4, depth: 0.4, height: 2.6, rotationDeg: 0 },
    ];
    for (const seed of [1, 2, 3]) {
      const { issues, result } = designWith(base, 'compleet', seed, pillars);
      expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(result.items.length).toBeGreaterThan(3);
    }
  });

  it('slaat toestellen over die niet onder het plafond passen', () => {
    const base = designFromPreset(ROOM_PRESETS[0]);
    base.room = { ...base.room, height: 2.0 };
    const { result, issues } = designWith(base, 'kracht', 1);
    const skipped = result.skipped.find((s) => s.productId === 'rogue-rml-390f');
    expect(skipped?.reason).toContain('plafond');
    expect(result.items.some((i) => i.productId === 'rogue-rml-390f')).toBe(false);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('meldt wat niet past in een heel kleine ruimte, zonder iets buiten de muren te zetten', () => {
    const base = designFromPreset(ROOM_PRESETS[0]);
    base.room = { ...base.room, width: 2, length: 2.2 };
    base.openings = [];
    const { result, issues } = designWith(base, 'compleet', 1);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('geeft bij een andere seed een andere variant', () => {
    const base = designFromPreset(ROOM_PRESETS[4]);
    const a = designWith(base, 'compleet', 1).result.items;
    const b = designWith(base, 'compleet', 99).result.items;
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
