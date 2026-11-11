import { describe, expect, it } from 'vitest';
import { resolveProduct, snapshotOf } from '../../catalog';
import { createDefaultDesign } from '../defaults';
import type { Design } from '../types';
import { exportDesign, exportFileName, importDesign, ImportError } from './serialize';

function sample(): Design {
  const d = createDefaultDesign();
  const rack = resolveProduct('rogue-rml-390f')!;
  const bench = resolveProduct('rogue-adjustable-bench-3')!;
  d.items = [
    { id: 'a', productId: 'rogue-rml-390f', label: rack.label, dimensions: rack.dimensions, x: 2, z: 0.62, y: 0, rotationDeg: 0 },
    { id: 'b', productId: 'rogue-adjustable-bench-3', label: bench.label, dimensions: bench.dimensions, x: 2, z: 1.2, y: 0, rotationDeg: 37.5 },
  ];
  d.obstacles = [{ id: 'o', name: 'Pilaar', x: 3.5, z: 3, width: 0.3, depth: 0.3, height: 2.6, rotationDeg: 0 }];
  return d;
}

describe('exporteren en importeren', () => {
  it('bewaart afmetingen, posities en rotaties exact in een rondgang via JSON', () => {
    const original = sample();
    const file = exportDesign(original, snapshotOf, 'test');
    const { design, warnings } = importDesign(JSON.parse(JSON.stringify(file)), { resolveProduct });
    expect(warnings).toEqual([]);
    expect(design.room).toEqual(original.room);
    expect(design.openings).toEqual(original.openings);
    expect(design.obstacles).toEqual(original.obstacles);
    expect(design.items).toEqual(original.items);
    expect(design.name).toBe(original.name);
  });

  it('neemt leesbare productgegevens en de maatvoering op in de export', () => {
    const file = exportDesign(sample(), snapshotOf, 'test');
    expect(file.format).toBe('homegym-ontwerp');
    expect(file.eenheden).toEqual({ lengte: 'meter', rotatie: 'graden' });
    const rack = file.design.items[0];
    expect(rack.product?.brand).toBe('Rogue');
    expect(rack.product?.priceEur).toBe(1115);
    expect(rack.dimensions.height).toBeCloseTo(2.34315, 9);
    expect(rack.product?.dimensionSourceUrl).toContain('roguefitness.com');
  });

  it('accepteert ook een kaal ontwerp-object (zoals in lokale opslag)', () => {
    const original = sample();
    const { design } = importDesign(JSON.parse(JSON.stringify(original)), { resolveProduct });
    expect(design.items).toEqual(original.items);
  });

  it('weigert onbruikbare bestanden met een duidelijke fout', () => {
    expect(() => importDesign('tekst')).toThrow(ImportError);
    expect(() => importDesign({ format: 'iets-anders', design: {} })).toThrow(/geen Homegym-ontwerp/);
    expect(() => importDesign({ format: 'homegym-ontwerp', version: 99, design: {} })).toThrow(/nieuwere versie/);
    expect(() => importDesign({ room: { width: 'breed' } })).toThrow(/afmetingen van de ruimte/);
  });

  it('slaat kapotte onderdelen over met een waarschuwing en houdt de rest', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.items.push({ id: 'x', productId: 'rogue-ohio-bar', x: 'NaN', z: 1 });
    raw.items.push({ productId: 42 });
    raw.openings.push({ kind: 'door', wall: 'plafond' });
    const { design, warnings } = importDesign(raw, { resolveProduct });
    expect(design.items).toHaveLength(2);
    expect(warnings.length).toBe(3);
  });

  it('behoudt onbekende producten met hun opgeslagen maten', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.items.push({
      id: 'z',
      productId: 'bestaat-niet-meer',
      label: 'Oud toestel',
      dimensions: { width: 1, depth: 2, height: 1.5 },
      x: 1,
      z: 4,
      y: 0,
      rotationDeg: 90,
    });
    const { design, warnings } = importDesign(raw, { resolveProduct });
    const old = design.items.find((i) => i.productId === 'bestaat-niet-meer')!;
    expect(old.dimensions).toEqual({ width: 1, depth: 2, height: 1.5 });
    expect(old.label).toBe('Oud toestel');
    expect(warnings.some((w) => w.includes('Oud toestel'))).toBe(true);
  });

  it('werkt afmetingen bij naar de actuele catalogus en meldt dat', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.items[0].dimensions.height = 2.0;
    const { design, warnings } = importDesign(raw, { resolveProduct });
    expect(design.items[0].dimensions.height).toBeCloseTo(2.34315, 9);
    expect(warnings.some((w) => w.includes('bijgewerkt'))).toBe(true);
  });

  it('begrenst waarden en herstelt dubbele ids', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.room.width = 500;
    raw.items[1].id = raw.items[0].id;
    raw.items[1].rotationDeg = -90;
    const { design } = importDesign(raw, { resolveProduct });
    expect(design.room.width).toBe(15);
    expect(new Set(design.items.map((i) => i.id)).size).toBe(2);
    expect(design.items[1].rotationDeg).toBe(270);
  });

  it('maakt een nette bestandsnaam', () => {
    const d = sample();
    d.name = 'Mijn Garage-gym ✨ 2026!';
    expect(exportFileName(d, 'json')).toMatch(/^homegym-mijn-garage-gym-2026-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
