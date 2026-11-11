import { DEFAULT_WALL_COLOR } from '../defaults';
import { clampOpening, normalizeDeg } from '../geometry/shapes';
import { newId } from '../id';
import type { Design, Dimensions, FloorFinish, Obstacle, Opening, PlacedItem, Room, WallId } from '../types';
import { ROOM_LIMITS } from '../types';

export const EXPORT_FORMAT = 'homegym-ontwerp';
export const EXPORT_VERSION = 1;

/** Leesbare productgegevens die met een export worden meegestuurd (niet nodig om te herstellen). */
export interface ProductSnapshot {
  brand: string;
  name: string;
  sku?: string;
  category: string;
  priceEur: number | null;
  supplier?: string;
  supplierUrl?: string;
  dimensionStatus: string;
  dimensionSourceUrl?: string;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  generator: string;
  eenheden: { lengte: 'meter'; rotatie: 'graden' };
  assenstelsel: string;
  design: Design & { items: (PlacedItem & { product?: ProductSnapshot })[] };
}

export function exportDesign(
  design: Design,
  snapshotOf: (productId: string) => ProductSnapshot | undefined,
  generator: string,
): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    generator,
    eenheden: { lengte: 'meter', rotatie: 'graden' },
    assenstelsel:
      'Oorsprong in de hoek achterwand/linkerwand op de vloer. x = breedte, z = lengte, y = hoogte. ' +
      'Positie (x, z) is het midden van de voetafdruk; y de onderkant. rotationDeg draait tegen de klok in (bovenaanzicht).',
    design: {
      ...design,
      items: design.items.map((item) => {
        const product = snapshotOf(item.productId);
        return product ? { ...item, product } : { ...item };
      }),
    },
  };
}

export class ImportError extends Error {}

export interface ImportResult {
  design: Design;
  warnings: string[];
}

export interface ImportOptions {
  /** Actuele catalogusgegevens; onbekende producten blijven behouden met hun opgeslagen maten. */
  resolveProduct?: (productId: string) => { label: string; dimensions: Dimensions } | undefined;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 120): string | null => (typeof v === 'string' ? v.slice(0, max) : null);
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const WALLS: WallId[] = ['north', 'east', 'south', 'west'];
const FLOORS: FloorFinish[] = ['rubber', 'hout', 'beton', 'vinyl'];

function parseRoom(raw: unknown): Room {
  if (!isObj(raw)) throw new ImportError('Het bestand bevat geen geldige ruimte.');
  const width = num(raw.width);
  const length = num(raw.length);
  const height = num(raw.height);
  if (width === null || length === null || height === null) {
    throw new ImportError('De afmetingen van de ruimte ontbreken of zijn ongeldig.');
  }
  const floor = FLOORS.includes(raw.floor as FloorFinish) ? (raw.floor as FloorFinish) : 'rubber';
  const wallColor = typeof raw.wallColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.wallColor) ? raw.wallColor : DEFAULT_WALL_COLOR;
  return {
    width: clamp(width, ROOM_LIMITS.width.min, ROOM_LIMITS.width.max),
    length: clamp(length, ROOM_LIMITS.length.min, ROOM_LIMITS.length.max),
    height: clamp(height, ROOM_LIMITS.height.min, ROOM_LIMITS.height.max),
    floor,
    wallColor,
  };
}

function parseDimensions(raw: unknown): Dimensions | null {
  if (!isObj(raw)) return null;
  const width = num(raw.width);
  const depth = num(raw.depth);
  const height = num(raw.height);
  if (width === null || depth === null || height === null) return null;
  if (width <= 0 || depth <= 0 || height <= 0 || width > 12 || depth > 12 || height > 8) return null;
  return { width, depth, height };
}

/**
 * Leest een geëxporteerd ontwerp (of een kaal Design-object) en valideert elk veld.
 * Ongeldige onderdelen worden overgeslagen met een waarschuwing; een onbruikbaar bestand geeft een ImportError.
 */
export function importDesign(raw: unknown, options: ImportOptions = {}): ImportResult {
  const warnings: string[] = [];
  if (!isObj(raw)) throw new ImportError('Dit is geen geldig ontwerpbestand.');

  let source: unknown = raw;
  if ('format' in raw || 'design' in raw) {
    if (raw.format !== EXPORT_FORMAT) throw new ImportError('Dit bestand is geen Homegym-ontwerp.');
    const version = num(raw.version);
    if (version !== null && version > EXPORT_VERSION) {
      throw new ImportError('Dit ontwerp is gemaakt met een nieuwere versie en kan niet worden geopend.');
    }
    source = raw.design;
  }
  if (!isObj(source)) throw new ImportError('Het bestand bevat geen ontwerp.');

  const room = parseRoom(source.room);
  const usedIds = new Set<string>();
  const uniqueId = (candidate: unknown, prefix: string) => {
    const id = str(candidate, 64);
    if (id && !usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    const fresh = newId(prefix);
    usedIds.add(fresh);
    return fresh;
  };

  const openings: Opening[] = [];
  for (const o of Array.isArray(source.openings) ? source.openings : []) {
    if (!isObj(o)) continue;
    const wall = WALLS.includes(o.wall as WallId) ? (o.wall as WallId) : null;
    const offset = num(o.offset);
    const width = num(o.width);
    const height = num(o.height);
    if (!wall || offset === null || width === null || height === null) {
      warnings.push('Een deur of raam is overgeslagen omdat de gegevens onvolledig waren.');
      continue;
    }
    const kind = o.kind === 'window' ? 'window' : 'door';
    openings.push(
      clampOpening(room, {
        id: uniqueId(o.id, 'opening'),
        kind,
        wall,
        offset,
        width,
        height,
        sill: num(o.sill) ?? (kind === 'window' ? 0.9 : 0),
        swing: o.swing === 'out' ? 'out' : 'in',
      }),
    );
  }

  const obstacles: Obstacle[] = [];
  for (const o of Array.isArray(source.obstacles) ? source.obstacles : []) {
    if (!isObj(o)) continue;
    const x = num(o.x);
    const z = num(o.z);
    const width = num(o.width);
    const depth = num(o.depth);
    const height = num(o.height);
    if (x === null || z === null || width === null || depth === null || height === null || width <= 0 || depth <= 0 || height <= 0) {
      warnings.push('Een obstakel is overgeslagen omdat de gegevens onvolledig waren.');
      continue;
    }
    obstacles.push({
      id: uniqueId(o.id, 'obstakel'),
      name: str(o.name, 60) || 'Obstakel',
      x,
      z,
      width: clamp(width, 0.05, 10),
      depth: clamp(depth, 0.05, 10),
      height: clamp(height, 0.05, 8),
      rotationDeg: normalizeDeg(num(o.rotationDeg) ?? 0),
    });
  }

  const items: PlacedItem[] = [];
  for (const it of Array.isArray(source.items) ? source.items : []) {
    if (!isObj(it)) continue;
    const productId = str(it.productId, 80);
    const x = num(it.x);
    const z = num(it.z);
    const storedDims = parseDimensions(it.dimensions);
    if (!productId || x === null || z === null) {
      warnings.push('Een apparaat is overgeslagen omdat de gegevens onvolledig waren.');
      continue;
    }
    const current = options.resolveProduct?.(productId);
    const dimensions = current?.dimensions ?? storedDims;
    if (!dimensions) {
      warnings.push(`Apparaat "${str(it.label, 80) ?? productId}" is overgeslagen: geen geldige afmetingen.`);
      continue;
    }
    const label = current?.label ?? str(it.label, 120) ?? 'Onbekend product';
    if (!current && options.resolveProduct) {
      warnings.push(`"${label}" staat niet (meer) in de catalogus en wordt getoond als eenvoudig blok met de opgeslagen maten.`);
    } else if (current && storedDims) {
      const changed =
        Math.abs(storedDims.width - current.dimensions.width) > 0.0005 ||
        Math.abs(storedDims.depth - current.dimensions.depth) > 0.0005 ||
        Math.abs(storedDims.height - current.dimensions.height) > 0.0005;
      if (changed) warnings.push(`De afmetingen van "${label}" zijn bijgewerkt naar de huidige catalogusgegevens.`);
    }
    items.push({
      id: uniqueId(it.id, 'item'),
      productId,
      label,
      dimensions: { ...dimensions },
      x: clamp(x, -5, room.width + 5),
      z: clamp(z, -5, room.length + 5),
      y: clamp(num(it.y) ?? 0, 0, 6),
      rotationDeg: normalizeDeg(num(it.rotationDeg) ?? 0),
    });
  }

  const now = new Date().toISOString();
  const design: Design = {
    schemaVersion: 1,
    id: str(source.id, 64) || newId('ontwerp'),
    name: str(source.name, 80)?.trim() || 'Geïmporteerd ontwerp',
    createdAt: str(source.createdAt, 40) || now,
    updatedAt: now,
    room,
    openings,
    obstacles,
    items,
  };
  return { design, warnings };
}

/** Bestandsnaam voor een export, bijv. "homegym-mijn-homegym-2026-11-10.json". */
export function exportFileName(design: Design, extension: string): string {
  const slug =
    design.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'ontwerp';
  return `homegym-${slug}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
