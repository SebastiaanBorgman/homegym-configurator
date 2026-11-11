import type { LayoutProduct } from '../domain/layout/autoLayout';
import { toCents, type PriceLookup } from '../domain/pricing';
import type { ProductSnapshot } from '../domain/storage/serialize';
import type { Dimensions, PhysicalSpec, SpecLookup } from '../domain/types';
import { collisionPartsFor, rackAnchorsFor } from './collision';
import { PRODUCTS } from './products';
import { supplierById } from './suppliers';
import type { Category, CategoryId, Offer, Product, Supplier, VerificationStatus } from './types';

export { PRODUCTS, CHECKED } from './products';
export { SUPPLIERS, supplierById } from './suppliers';
export type * from './types';

export const CATEGORIES: Category[] = [
  { id: 'racks', label: 'Power racks & squat racks', short: 'Racks' },
  { id: 'banken', label: 'Trainingsbanken', short: 'Banken' },
  { id: 'barbells', label: 'Barbells', short: 'Barbells' },
  { id: 'schijven', label: 'Halterschijven', short: 'Schijven' },
  { id: 'dumbbells', label: 'Dumbbells', short: 'Dumbbells' },
  { id: 'dumbbellrekken', label: 'Dumbbellrekken', short: 'Rekken' },
  { id: 'kabelstations', label: 'Kabelstations', short: 'Kabels' },
  { id: 'krachtstations', label: 'Multifunctionele krachtstations', short: 'Stations' },
  { id: 'cardio', label: 'Cardioapparatuur', short: 'Cardio' },
  { id: 'accessoires', label: 'Overige accessoires', short: 'Overig' },
];

export const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));

export const STATUS_META: Record<VerificationStatus, { label: string; short: string; description: string }> = {
  verified: {
    label: 'Afmetingen geverifieerd',
    short: 'Geverifieerd',
    description: 'Alle maten zijn letterlijk overgenomen van de pagina van de fabrikant of leverancier.',
  },
  partial: {
    label: 'Afmetingen deels geverifieerd',
    short: 'Deels geverifieerd',
    description: 'Een deel van de maten is geverifieerd; de overige maat is niet gepubliceerd en indicatief.',
  },
  derived: {
    label: 'Afmetingen afgeleid',
    short: 'Afgeleid',
    description: 'Berekend uit geverifieerde fabrikantmaten (bijvoorbeeld de hoogte van een stapel schijven).',
  },
  unverified: {
    label: 'Afmetingen niet geverifieerd',
    short: 'Niet geverifieerd',
    description: 'De bron kon niet rechtstreeks worden gecontroleerd. Uitsluitend ter demonstratie.',
  },
};

const productMap = new Map(PRODUCTS.map((p) => [p.id, p]));
const specMap = new Map<string, PhysicalSpec>(
  PRODUCTS.map((p) => [
    p.id,
    {
      name: productLabel(p),
      mobility: p.mobility,
      collisionParts: collisionPartsFor(p),
      clearance: p.clearance,
      overheadUse: p.overheadUse,
    },
  ]),
);

export function getProduct(id: string): Product | undefined {
  return productMap.get(id);
}

export function productLabel(p: Pick<Product, 'brand' | 'name'>): string {
  return `${p.brand} ${p.name}`;
}

export function primaryOffer(p: Product): Offer {
  return p.offers[0];
}

export function supplierOf(p: Product): Supplier | undefined {
  return supplierById.get(primaryOffer(p).supplierId);
}

/** Prijs per stuk in centen, of null als er geen betrouwbare prijs is. */
export function priceCents(p: Product): number | null {
  const amount = primaryOffer(p).price.amount;
  return amount === null ? null : toCents(amount);
}

/**
 * Centrale plek voor uitgaande links. Zodra een affiliateprogramma actief is, hoeft alleen
 * `offer.affiliate` gevuld te worden; de rest van de applicatie blijft ongewijzigd.
 */
export function outboundUrl(offer: Offer): string {
  return offer.affiliate.enabled && offer.affiliate.trackingUrl ? offer.affiliate.trackingUrl : offer.url;
}

/** Fysieke eigenschappen voor de ruimtecontrole; onbekende producten gelden als massief blok. */
export const specOf: SpecLookup = (item) =>
  specMap.get(item.productId) ?? { name: item.label || 'Onbekend product', mobility: 'fixed' };

export const priceOf: PriceLookup = (productId) => {
  const p = productMap.get(productId);
  return { unitCents: p ? priceCents(p) : null };
};

export function resolveProduct(productId: string): { label: string; dimensions: Dimensions } | undefined {
  const p = productMap.get(productId);
  return p ? { label: productLabel(p), dimensions: { ...p.dimensions } } : undefined;
}

export function snapshotOf(productId: string): ProductSnapshot | undefined {
  const p = productMap.get(productId);
  if (!p) return undefined;
  const o = primaryOffer(p);
  return {
    brand: p.brand,
    name: p.variant ? `${p.name} (${p.variant})` : p.name,
    sku: p.sku,
    category: categoryById.get(p.category)?.label ?? p.category,
    priceEur: o.price.amount,
    supplier: supplierById.get(o.supplierId)?.name,
    supplierUrl: o.url,
    dimensionStatus: STATUS_META[p.dimensionInfo.status].short,
    dimensionSourceUrl: p.dimensionInfo.sourceUrl,
  };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Zoeken en filteren; elke zoekterm moet ergens in merk, naam, variant, categorie of sku voorkomen. */
export function searchProducts(query: string, category: CategoryId | 'alle'): Product[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return PRODUCTS.filter((p) => {
    if (category !== 'alle' && p.category !== category) return false;
    if (!terms.length) return true;
    const haystack = normalize(
      [p.brand, p.name, p.variant ?? '', p.sku ?? '', categoryById.get(p.category)?.label ?? '', p.description].join(' '),
    );
    return terms.every((t) => haystack.includes(t));
  });
}

export function countByCategory(): Map<CategoryId, number> {
  const counts = new Map<CategoryId, number>();
  for (const p of PRODUCTS) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return counts;
}

// ───────────────────────── Profielen voor "Genereer een indeling" ─────────────────────────

export interface LayoutProfile {
  id: string;
  label: string;
  description: string;
  /** Op volgorde van belang. */
  productIds: string[];
}

export const LAYOUT_PROFILES: LayoutProfile[] = [
  {
    id: 'starter',
    label: 'Compacte starter',
    description: 'Betaalbare basis voor krachttraining op weinig vierkante meters.',
    productIds: [
      'tunturi-pr60',
      'tunturi-ub100',
      'rogue-ohio-bar',
      'rogue-echo-bumper-100',
      'tunturi-dumbbell-tower',
      'tunturi-cardio-fit-c30',
      'tunturi-kettlebell-16',
    ],
  },
  {
    id: 'kracht',
    label: 'Krachtsport',
    description: 'Rack, bank, stang en schijven als kern, met dumbbells en een airbike.',
    productIds: [
      'rogue-rml-390f',
      'rogue-adjustable-bench-3',
      'rogue-ohio-bar',
      'rogue-echo-bumper-150',
      'tunturi-hex-dumbbell-set',
      'rogue-echo-bike-v3',
      'rogue-flat-pack-games-box',
      'tunturi-kettlebell-16',
    ],
  },
  {
    id: 'compleet',
    label: 'Compleet & luxe',
    description: 'Volledig uitgeruste gym met kabelstation en meerdere cardiotoestellen.',
    productIds: [
      'rogue-rml-390f',
      'rogue-adjustable-bench-3',
      'rogue-ohio-bar',
      'rogue-echo-bumper-150',
      'tunturi-platinum-functional-trainer',
      'tunturi-hex-dumbbell-set',
      'tunturi-cardio-fit-t60',
      'concept2-rowerg',
      'concept2-bikeerg',
      'concept2-skierg-floorstand',
      'rogue-flat-pack-games-box',
      'tunturi-kettlebell-16',
    ],
  },
  {
    id: 'cardio',
    label: 'Cardio & conditie',
    description: 'Nadruk op uithoudingsvermogen, met dumbbells en een bank voor de kracht.',
    productIds: [
      'tunturi-cardio-fit-t60',
      'concept2-rowerg',
      'concept2-bikeerg',
      'rogue-echo-bike-v3',
      'tunturi-cardio-fit-c30',
      'tunturi-hex-dumbbell-set',
      'tunturi-ub100',
      'tunturi-kettlebell-16',
    ],
  },
];

export function layoutProductsFor(profileId: string): LayoutProduct[] {
  const profile = LAYOUT_PROFILES.find((p) => p.id === profileId) ?? LAYOUT_PROFILES[0];
  return profile.productIds.flatMap((id) => {
    const p = productMap.get(id);
    const spec = specMap.get(id);
    if (!p || !spec) return [];
    return [
      { productId: p.id, label: productLabel(p), dimensions: { ...p.dimensions }, spec, role: p.layoutRole, anchors: rackAnchorsFor(p) },
    ];
  });
}
