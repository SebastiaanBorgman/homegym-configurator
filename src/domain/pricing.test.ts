import { describe, expect, it } from 'vitest';
import { buildOrder, formatEuro, formatEuroCompact, toCents, type PriceLookup } from './pricing';
import type { PlacedItem } from './types';

const prices: Record<string, number | null> = { rack: 1115.0, bench: 762.3, plates: 453.75, mystery: null, cheap: 0.1 };
const priceOf: PriceLookup = (id) => {
  const amount = prices[id];
  return { unitCents: amount === null || amount === undefined ? null : toCents(amount) };
};

const item = (id: string, productId: string): PlacedItem => ({
  id,
  productId,
  label: productId,
  dimensions: { width: 1, depth: 1, height: 1 },
  x: 0,
  z: 0,
  y: 0,
  rotationDeg: 0,
});

describe('prijsberekening', () => {
  it('rekent in hele centen', () => {
    expect(toCents(762.3)).toBe(76230);
    expect(toCents(0.1) + toCents(0.2)).toBe(30); // geen 0.30000000000000004
    expect(toCents(1115)).toBe(111500);
  });

  it('geeft een lege bestellijst voor een leeg ontwerp', () => {
    expect(buildOrder([], priceOf)).toEqual({ lines: [], totalCents: 0, itemCount: 0, unpricedCount: 0 });
  });

  it('groepeert per product en telt aantallen en regeltotalen op', () => {
    const order = buildOrder([item('a', 'rack'), item('b', 'bench'), item('c', 'bench'), item('d', 'plates')], priceOf);
    expect(order.lines).toHaveLength(3);
    const bench = order.lines.find((l) => l.productId === 'bench')!;
    expect(bench.quantity).toBe(2);
    expect(bench.unitCents).toBe(76230);
    expect(bench.lineCents).toBe(152460);
    expect(bench.itemIds).toEqual(['b', 'c']);
    expect(order.itemCount).toBe(4);
    expect(order.totalCents).toBe(111500 + 152460 + 45375);
  });

  it('past het totaal aan wanneer er een apparaat bij komt of af gaat', () => {
    const base = [item('a', 'rack')];
    expect(buildOrder(base, priceOf).totalCents).toBe(111500);
    expect(buildOrder([...base, item('b', 'plates')], priceOf).totalCents).toBe(156875);
    expect(buildOrder([], priceOf).totalCents).toBe(0);
  });

  it('telt producten zonder prijs niet mee en meldt ze apart', () => {
    const order = buildOrder([item('a', 'rack'), item('b', 'mystery'), item('c', 'mystery')], priceOf);
    expect(order.totalCents).toBe(111500);
    expect(order.unpricedCount).toBe(2);
    const line = order.lines.find((l) => l.productId === 'mystery')!;
    expect(line.unitCents).toBeNull();
    expect(line.lineCents).toBeNull();
  });

  it('maakt geen afrondingsfouten bij veel kleine bedragen', () => {
    const many = Array.from({ length: 30 }, (_, i) => item(`i${i}`, 'cheap'));
    expect(buildOrder(many, priceOf).totalCents).toBe(300);
  });

  it('formatteert bedragen in het Nederlands', () => {
    expect(formatEuro(111500).replace(/\s/g, ' ')).toBe('€ 1.115,00');
    expect(formatEuro(76230).replace(/\s/g, ' ')).toBe('€ 762,30');
    expect(formatEuroCompact(111500).replace(/\s/g, ' ')).toBe('€ 1.115');
    expect(formatEuroCompact(76230).replace(/\s/g, ' ')).toBe('€ 762,30');
  });
});
