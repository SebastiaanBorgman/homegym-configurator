import { describe, expect, it } from 'vitest';
import { fullLocalBox } from '../domain/geometry/shapes';
import {
  CATEGORIES,
  LAYOUT_PROFILES,
  PRODUCTS,
  getProduct,
  outboundUrl,
  priceCents,
  primaryOffer,
  searchProducts,
  supplierById,
} from './index';
import { collisionPartsFor } from './collision';

/**
 * Onafhankelijke controletabel: de maten zoals ze in de BRON staan, in centimeters
 * [breedte, diepte, hoogte]. Inch-waarden staan hier bewust als inch × 2,54.
 * Wijkt de catalogus hiervan af, dan faalt de test.
 */
const IN = 2.54;
const SOURCE_CM: Record<string, [number, number, number]> = {
  'rogue-rml-390f': [48 * IN, 49 * IN, 92.25 * IN],
  'tunturi-pr60': [135, 123, 213.7],
  'tunturi-hr60': [138, 160.6, 212.5],
  'rogue-adjustable-bench-3': [24.75 * IN, 56.5 * IN, 17.5 * IN],
  'tunturi-ub100': [60, 167, 65],
  'rogue-ohio-bar': [86.75 * IN, 5, 5],
  'rogue-echo-bumper-100': [45, 45, 2 * (2.4 + 3.4 + 4.7 + 5.8)],
  'rogue-echo-bumper-150': [45, 45, 2 * (2.4 + 3.4 + 4.7 + 5.8 + 7.0)],
  'tunturi-hex-dumbbell-set': [132.4, 58.1, 87.7],
  'bowflex-selecttech-552i': [43, 21.1, 22.8],
  'rogue-universal-storage-3tier': [76.5 * IN, 23.75 * IN, (45.25 + 3.25) * IN],
  'tunturi-dumbbell-tower': [51, 51, 128.8],
  'tunturi-hex-dumbbell-rack': [132.4, 58.1, 87.7],
  'tunturi-platinum-functional-trainer': [153, 76, 225],
  'tunturi-hg60': [114, 168, 212],
  'tunturi-wt85': [150, 177, 210],
  'force-usa-g3': [78 * IN, 60.5 * IN, 87 * IN],
  'concept2-rowerg': [61, 244, 100],
  'concept2-bikeerg': [61, 122, 125],
  'concept2-skierg-floorstand': [23.5 * IN, 50 * IN, 85 * IN],
  'rogue-echo-bike-v3': [75, 139.7, 132.7],
  'tunturi-cardio-fit-t60': [83.5, 170.1, 134.9],
  'tunturi-cardio-fit-c30': [60, 124, 163],
  'tunturi-kettlebell-16': [19.5, 15.2, 23.6],
  'rogue-flat-pack-games-box': [30 * IN, 24 * IN, 20 * IN],
};

describe('productcatalogus', () => {
  it('heeft unieke ids en een geldige categorie per product', () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    const categories = new Set(CATEGORIES.map((c) => c.id));
    for (const p of PRODUCTS) expect(categories.has(p.category), p.id).toBe(true);
  });

  it('dekt alle tien de categorieën', () => {
    for (const c of CATEGORIES) {
      expect(PRODUCTS.some((p) => p.category === c.id), c.label).toBe(true);
    }
  });

  it('gebruikt exact de afmetingen uit de bron', () => {
    expect(Object.keys(SOURCE_CM).sort()).toEqual(PRODUCTS.map((p) => p.id).sort());
    for (const p of PRODUCTS) {
      const [w, d, h] = SOURCE_CM[p.id];
      expect(p.dimensions.width * 100, `${p.id} breedte`).toBeCloseTo(w, 6);
      expect(p.dimensions.depth * 100, `${p.id} diepte`).toBeCloseTo(d, 6);
      expect(p.dimensions.height * 100, `${p.id} hoogte`).toBeCloseTo(h, 6);
    }
  });

  it('heeft bij elk product een bron, controledatum en uitleg van de maatvoering', () => {
    for (const p of PRODUCTS) {
      const info = p.dimensionInfo;
      expect(info.sourceUrl, p.id).toMatch(/^https:\/\//);
      expect(info.checkedAt, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(info.quote.length, p.id).toBeGreaterThan(5);
      expect(info.mapping.length, p.id).toBeGreaterThan(10);
      expect(info.measured.length, p.id).toBeGreaterThan(10);
      // Alles wat niet volledig geverifieerd is, moet uitleggen waarom.
      if (info.status !== 'verified') expect(info.note, p.id).toBeTruthy();
    }
  });

  it('markeert niet-geverifieerde producten expliciet en geeft ze geen verzonnen prijs', () => {
    const unverified = PRODUCTS.filter((p) => p.dimensionInfo.status === 'unverified');
    expect(unverified.map((p) => p.id).sort()).toEqual(['bowflex-selecttech-552i', 'force-usa-g3']);
    for (const p of unverified) {
      expect(p.dimensionInfo.note).toContain('NIET GEVERIFIEERD');
      expect(priceCents(p)).toBeNull();
    }
  });

  it('heeft per product een echte leverancierslink en geen verzonnen affiliatecodes', () => {
    for (const p of PRODUCTS) {
      expect(p.offers.length, p.id).toBeGreaterThan(0);
      const offer = primaryOffer(p);
      expect(supplierById.has(offer.supplierId), p.id).toBe(true);
      expect(offer.url, p.id).toMatch(/^https:\/\//);
      expect(offer.affiliate).toEqual({ enabled: false, trackingUrl: null });
      expect(outboundUrl(offer)).toBe(offer.url);
      expect(offer.price.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (offer.price.amount !== null) expect(offer.price.amount).toBeGreaterThan(0);
      if (offer.price.regularAmount !== undefined) expect(offer.price.regularAmount).toBeGreaterThan(offer.price.amount ?? 0);
    }
  });

  it('gebruikt een voorbereide affiliate-link zodra die actief is', () => {
    const offer = { ...primaryOffer(PRODUCTS[0]), affiliate: { enabled: true, trackingUrl: 'https://voorbeeld.test/track' } };
    expect(outboundUrl(offer)).toBe('https://voorbeeld.test/track');
  });

  it('houdt botsingsdelen binnen de buitenmaten van het product', () => {
    for (const p of PRODUCTS) {
      const parts = collisionPartsFor(p);
      if (!parts) continue;
      const full = fullLocalBox(p.dimensions);
      const eps = 1e-9;
      for (const part of parts) {
        expect(part.x0 >= full.x0 - eps && part.x1 <= full.x1 + eps, `${p.id} x`).toBe(true);
        expect(part.z0 >= full.z0 - eps && part.z1 <= full.z1 + eps, `${p.id} z`).toBe(true);
        expect(part.y0 >= -eps && part.y1 <= full.y1 + eps, `${p.id} y`).toBe(true);
        expect(part.x1 > part.x0 && part.z1 > part.z0 && part.y1 > part.y0, `${p.id} volume`).toBe(true);
      }
    }
  });

  it('zoekt op merk, naam en categorie en filtert op categorie', () => {
    expect(searchProducts('', 'alle')).toHaveLength(PRODUCTS.length);
    expect(searchProducts('rogue rack', 'alle').map((p) => p.id)).toEqual(['rogue-rml-390f']);
    expect(searchProducts('TUNTURI', 'cardio').map((p) => p.id).sort()).toEqual(['tunturi-cardio-fit-c30', 'tunturi-cardio-fit-t60']);
    expect(searchProducts('loopband', 'alle').map((p) => p.id)).toEqual(['tunturi-cardio-fit-t60']);
    expect(searchProducts('bestaat niet', 'alle')).toEqual([]);
    expect(searchProducts('', 'banken')).toHaveLength(2);
  });

  it('verwijst in de indelingsprofielen alleen naar bestaande producten', () => {
    for (const profile of LAYOUT_PROFILES) {
      for (const id of profile.productIds) expect(getProduct(id), `${profile.id}: ${id}`).toBeDefined();
    }
  });
});
