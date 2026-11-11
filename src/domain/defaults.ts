import { newId } from './id';
import type { Design, FloorFinish, Obstacle, Opening, Room } from './types';

export const DEFAULT_WALL_COLOR = '#ecebe6';

export const WALL_COLORS: { value: string; label: string }[] = [
  { value: '#ecebe6', label: 'Gebroken wit' },
  { value: '#d9d6cf', label: 'Zand' },
  { value: '#b9bdc0', label: 'Lichtgrijs' },
  { value: '#5b6166', label: 'Antraciet' },
  { value: '#2b2f33', label: 'Zwartgrijs' },
  { value: '#c9d2c4', label: 'Saliegroen' },
];

export const FLOOR_OPTIONS: { value: FloorFinish; label: string; swatch: string }[] = [
  { value: 'rubber', label: 'Rubber', swatch: '#2a2c2f' },
  { value: 'hout', label: 'Hout', swatch: '#b88d5e' },
  { value: 'beton', label: 'Beton', swatch: '#9a9c9d' },
  { value: 'vinyl', label: 'Vinyl', swatch: '#cfc9bd' },
];

export interface RoomPreset {
  id: string;
  label: string;
  hint: string;
  room: Room;
  openings: Omit<Opening, 'id'>[];
  obstacles: Omit<Obstacle, 'id'>[];
}

const door = (wall: Opening['wall'], offset: number, width = 0.9, swing: Opening['swing'] = 'in'): Omit<Opening, 'id'> => ({
  kind: 'door',
  wall,
  offset,
  width,
  height: 2.1,
  sill: 0,
  swing,
});

const win = (wall: Opening['wall'], offset: number, width = 1.2, height = 1.1, sill = 0.9): Omit<Opening, 'id'> => ({
  kind: 'window',
  wall,
  offset,
  width,
  height,
  sill,
  swing: 'in',
});

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: 'voorbeeld',
    label: 'Voorbeeldruimte',
    hint: '4 × 6 m',
    room: { width: 4, length: 6, height: 2.6, floor: 'rubber', wallColor: DEFAULT_WALL_COLOR },
    openings: [door('west', 4.7), win('north', 1.4)],
    obstacles: [],
  },
  {
    id: 'garage',
    label: 'Garage',
    hint: '3 × 6 m',
    room: { width: 3, length: 6, height: 2.4, floor: 'beton', wallColor: '#d9d6cf' },
    openings: [door('south', 0.3, 2.4, 'out'), door('east', 0.6)],
    obstacles: [],
  },
  {
    id: 'slaapkamer',
    label: 'Slaapkamer',
    hint: '3 × 3,5 m',
    room: { width: 3, length: 3.5, height: 2.6, floor: 'hout', wallColor: DEFAULT_WALL_COLOR },
    openings: [door('south', 0.25), win('north', 0.9)],
    obstacles: [],
  },
  {
    id: 'zolder',
    label: 'Zolder',
    hint: '4,5 × 6 m',
    room: { width: 4.5, length: 6, height: 2.2, floor: 'vinyl', wallColor: DEFAULT_WALL_COLOR },
    openings: [door('south', 3.3), win('west', 2.2, 1.0, 0.9, 1.0), win('east', 2.2, 1.0, 0.9, 1.0)],
    obstacles: [],
  },
  {
    id: 'bijgebouw',
    label: 'Bijgebouw',
    hint: '5 × 7 m',
    room: { width: 5, length: 7, height: 2.5, floor: 'rubber', wallColor: '#b9bdc0' },
    openings: [door('south', 1.7, 1.6, 'out'), win('east', 1.2, 1.6), win('east', 4.2, 1.6), win('north', 1.9)],
    obstacles: [],
  },
];

export function designFromPreset(preset: RoomPreset, name = 'Mijn homegym'): Design {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: newId('ontwerp'),
    name,
    createdAt: now,
    updatedAt: now,
    room: { ...preset.room },
    openings: preset.openings.map((o) => ({ ...o, id: newId('opening') })),
    obstacles: preset.obstacles.map((o) => ({ ...o, id: newId('obstakel') })),
    items: [],
  };
}

/** Startontwerp: lege voorbeeldruimte van 4 × 6 × 2,6 m. */
export function createDefaultDesign(): Design {
  return designFromPreset(ROOM_PRESETS[0]);
}
