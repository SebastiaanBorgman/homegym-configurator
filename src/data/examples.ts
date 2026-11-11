import { layoutProductsFor, priceOf } from '../catalog';
import { ROOM_PRESETS, designFromPreset } from '../domain/defaults';
import { generateLayout } from '../domain/layout/autoLayout';
import { buildOrder } from '../domain/pricing';
import type { Design } from '../domain/types';

/**
 * Voorbeeldontwerpen voor de homepage. Ze worden niet als vaste lijst opgeslagen maar met de
 * indelingsgenerator opgebouwd uit de actuele catalogus (met een vaste seed, dus steeds gelijk).
 * Zo kloppen maten, prijzen en ruimtecontrole altijd met de rest van de applicatie.
 */

export interface ExampleDef {
  id: string;
  title: string;
  kicker: string;
  description: string;
  presetId: string;
  profileId: string;
  seed: number;
}

export const HERO_EXAMPLE: ExampleDef = {
  id: 'hero',
  title: 'Mijn homegym',
  kicker: 'Voorbeeldruimte · 4 × 6 m',
  description: '',
  presetId: 'voorbeeld',
  profileId: 'kracht',
  seed: 5,
};

export const EXAMPLES: ExampleDef[] = [
  {
    id: 'garage-kracht',
    title: 'De garagegym',
    kicker: 'Garage · 3 × 6 m',
    description: 'Power rack, bank, stang en schijven langs de wand, met dumbbells en een airbike erbij. De garagedeur blijft vrij.',
    presetId: 'garage',
    profileId: 'kracht',
    seed: 11,
  },
  {
    id: 'slaapkamer-starter',
    title: 'Compact op de logeerkamer',
    kicker: 'Slaapkamer · 3 × 3,5 m',
    description: 'Een betaalbaar rek met bank en een dumbbelltoren: complete krachttraining op ruim tien vierkante meter.',
    presetId: 'slaapkamer',
    profileId: 'starter',
    seed: 4,
  },
  {
    id: 'bijgebouw-compleet',
    title: 'Het complete bijgebouw',
    kicker: 'Bijgebouw · 5 × 7 m',
    description: 'Rack, kabelstation, dumbbells en vier cardiotoestellen. Ruimte genoeg om met z’n tweeën te trainen.',
    presetId: 'bijgebouw',
    profileId: 'compleet',
    seed: 7,
  },
];

export interface BuiltExample {
  def: ExampleDef;
  design: Design;
  totalCents: number;
  itemCount: number;
}

const cache = new Map<string, BuiltExample>();

export function buildExample(def: ExampleDef): BuiltExample {
  const cached = cache.get(def.id);
  if (cached) return cached;
  const preset = ROOM_PRESETS.find((p) => p.id === def.presetId) ?? ROOM_PRESETS[0];
  const design = designFromPreset(preset, def.title);
  const result = generateLayout({
    room: design.room,
    openings: design.openings,
    obstacles: design.obstacles,
    products: layoutProductsFor(def.profileId),
    seed: def.seed,
    attempts: 4,
  });
  design.id = `voorbeeld-${def.id}`;
  design.items = result.items.map((item, index) => ({ ...item, id: `${def.id}-${index}` }));
  const order = buildOrder(design.items, priceOf);
  const built: BuiltExample = { def, design, totalCents: order.totalCents, itemCount: order.itemCount };
  cache.set(def.id, built);
  return built;
}
