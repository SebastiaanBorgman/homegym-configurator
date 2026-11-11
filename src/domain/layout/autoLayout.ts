import {
  aabbOf,
  doorZoneBox,
  fullLocalBox,
  localToWorld,
  obstacleBox,
  orientedBoxFromLocal,
  outsideRoomDistance,
  penetration2D,
  penetration3D,
  rotatedHalfExtents,
  wallFrame,
  wallLength,
  type OrientedBox,
  type Vec2,
} from '../geometry/shapes';
import { clearanceBox, itemParts } from '../geometry/validation';
import { ROTATION_BACK_TO_WALL } from '../geometry/placement';
import type { Dimensions, Obstacle, Opening, PhysicalSpec, PlacedItem, Room, WallId } from '../types';

/**
 * Regelgebaseerde indelingsgenerator.
 *
 * Werkwijze: de gevraagde producten worden op volgorde van belang geplaatst. Per product worden
 * honderden kandidaat-posities langs de muren (en als vangnet vrij in de ruimte) doorgerekend met
 * dezelfde geometrie als de ruimtecontrole. Ongeldige posities vallen af; de rest krijgt een score
 * (achterzijde tegen de muur, weinig uitsteken, deur vrij, bij elkaar horende spullen dicht bij
 * elkaar, cardio bij een raam). Dit wordt met verschillende willekeurige accenten herhaald en de
 * beste poging wint. Een toestel wordt alleen geplaatst als ook zijn gebruiksruimte vrij blijft;
 * lukt dat nergens, dan wordt het overgeslagen en gemeld — de generator stelt dus niets voor dat
 * zijn eigen ruimtecontrole niet doorstaat. Het resultaat blijft een SUGGESTIE, geen gegarandeerd
 * optimale of veilige indeling.
 */

export type LayoutRole =
  /** Power rack / squat rack: het anker van een krachthoek. */
  | 'rack'
  | 'bench'
  | 'barbell'
  | 'plates'
  /** Opbergrekken en dumbbellsets. */
  | 'storage'
  /** Grote krachtmachines: kabelstation, multigym. */
  | 'machine'
  | 'cardio'
  /** Klein los materiaal. */
  | 'small';

/** Vaste punten van een rek (lokale coördinaten) waar een bank en een stang horen. */
export interface RackAnchors {
  /** z en y van de stang op de J-cups. */
  barZ: number;
  barY: number;
  /** z waar het hoofdeinde van een bank begint. */
  benchBackZ: number;
}

export interface LayoutProduct {
  productId: string;
  label: string;
  dimensions: Dimensions;
  spec: PhysicalSpec;
  role: LayoutRole;
  anchors?: RackAnchors;
}

export interface LayoutRequest {
  room: Room;
  openings: Opening[];
  obstacles: Obstacle[];
  /** Op volgorde van belang: het eerste product krijgt de beste plek. */
  products: LayoutProduct[];
  seed: number;
  attempts?: number;
}

export interface LayoutSkip {
  productId: string;
  label: string;
  reason: string;
}

export interface LayoutResult {
  items: PlacedItem[];
  skipped: LayoutSkip[];
  score: number;
}

interface Entry {
  item: PlacedItem;
  product: LayoutProduct;
  box: OrientedBox;
  parts: OrientedBox[];
  zone: OrientedBox | null;
}

const WALLS: WallId[] = ['north', 'east', 'south', 'west'];
const WALL_GAP = 0.02;
const SPACING = 0.05;

/** Kleine, deterministische pseudo-willekeurige generator (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inflate(b: OrientedBox, by: number): OrientedBox {
  return { ...b, hw: b.hw + by, hd: b.hd + by };
}

function makeEntry(product: LayoutProduct, pose: { x: number; z: number; y: number; rotationDeg: number }, index: number): Entry {
  const item: PlacedItem = {
    id: `gen_${index}`,
    productId: product.productId,
    label: product.label,
    dimensions: { ...product.dimensions },
    x: pose.x,
    z: pose.z,
    y: pose.y,
    rotationDeg: pose.rotationDeg,
  };
  return {
    item,
    product,
    box: orientedBoxFromLocal(fullLocalBox(product.dimensions), pose),
    parts: itemParts(item, product.spec),
    zone: clearanceBox(item, product.spec),
  };
}

interface Context {
  room: Room;
  doorZones: OrientedBox[];
  doorCentres: Vec2[];
  obstacleBoxes: OrientedBox[];
  windowSpans: { wall: WallId; from: number; to: number }[];
  placed: Entry[];
}

/** Harde eisen: binnen de ruimte, nergens doorheen, deur vrij en (strikt) alle gebruiksruimte vrij. */
function isValid(c: Entry, ctx: Context, strictZones: boolean): boolean {
  if (outsideRoomDistance(c.box, ctx.room) > 0.001) return false;
  if (c.item.y + c.item.dimensions.height > ctx.room.height + 0.001) return false;

  const spaced = c.parts.map((p) => inflate(p, SPACING / 2));
  for (const o of ctx.obstacleBoxes) {
    if (spaced.some((p) => penetration3D(p, o) > 0.001)) return false;
  }
  for (const other of ctx.placed) {
    const otherSpaced = other.parts.map((p) => inflate(p, SPACING / 2));
    for (const p of spaced) for (const q of otherSpaced) if (penetration3D(p, q) > 0.001) return false;
  }
  for (const d of ctx.doorZones) {
    if (penetration2D(inflate(c.box, 0.05), d) > 0.001) return false;
  }

  if (strictZones) {
    // Eigen gebruiksruimte moet binnen de muren vallen en vrij zijn van vaste toestellen en obstakels…
    if (c.zone) {
      if (outsideRoomDistance(c.zone, ctx.room) > 0.015) return false;
      for (const o of ctx.obstacleBoxes) if (penetration3D(c.zone, o) > 0.02) return false;
      for (const other of ctx.placed) {
        if (other.product.spec.mobility !== 'fixed') continue;
        if (other.parts.some((p) => penetration3D(c.zone!, p) > 0.02)) return false;
      }
    }
    // …en een nieuw toestel mag niet in andermans gebruiksruimte staan.
    for (const other of ctx.placed) {
      if (!other.zone) continue;
      if (c.parts.some((p) => penetration3D(other.zone!, p) > 0.02)) return false;
    }
  }
  return true;
}

function distanceToNearest(p: Vec2, points: Vec2[]): number {
  let min = Infinity;
  for (const q of points) min = Math.min(min, Math.hypot(p.x - q.x, p.z - q.z));
  return min;
}

function scoreCandidate(c: Entry, wall: WallId | null, ctx: Context, rng: () => number): number {
  const { room } = ctx;
  const { role } = c.product;
  const pos = { x: c.item.x, z: c.item.z };
  let score = 0;

  if (wall) {
    const backToWall = ROTATION_BACK_TO_WALL[wall] === c.item.rotationDeg;
    const frontToWall = (ROTATION_BACK_TO_WALL[wall] + 180) % 360 === c.item.rotationDeg;
    const alongX = wall === 'north' || wall === 'south';
    const { hx, hz } = rotatedHalfExtents(c.item.dimensions, c.item.rotationDeg);
    const protrusion = (alongX ? hz : hx) * 2;
    const footprintIsSquare = Math.abs(c.item.dimensions.width - c.item.dimensions.depth) < 0.05;

    if (backToWall) score += 30;
    else if (frontToWall) score -= 40;
    else score += footprintIsSquare ? 0 : 12;
    score -= protrusion * 15;

    // Positie langs de muur
    const f = wallFrame(room, wall);
    const along = (pos.x - f.start.x) * f.along.x + (pos.z - f.start.z) * f.along.z;
    const len = wallLength(room, wall);
    const half = (alongX ? hx : hz);
    const cornerGap = Math.min(along - half, len - along - half);
    if (role === 'rack') {
      score += 10 * (1 - Math.abs(along - len / 2) / (len / 2));
    } else if (role === 'storage' || role === 'small' || role === 'plates') {
      score += 14 * (1 - Math.min(1, cornerGap / 2));
    } else {
      score += 5 * (1 - Math.min(1, cornerGap / 2.5));
    }
    // Onbruikbare kieren naast een hoek vermijden
    if (cornerGap > 0.06 && cornerGap < 0.45) score -= 6;

    if (role === 'cardio') {
      const nearWindow = ctx.windowSpans.some((w) => w.wall === wall && along > w.from - 1 && along < w.to + 1);
      if (nearWindow) score += 8;
    }
  } else {
    score -= 45; // vrijstaand midden in de ruimte is het laatste redmiddel
  }

  if (role === 'rack' || role === 'machine' || role === 'cardio') {
    score += Math.min(distanceToNearest(pos, ctx.doorCentres), 4) * 3;
  }

  // Bij elkaar horende spullen groeperen.
  const anchors = (roles: string[]) => ctx.placed.filter((e) => roles.includes(e.product.role)).map((e) => ({ x: e.item.x, z: e.item.z }));
  const pull = (roles: string[], weight: number, cap = 6) => {
    const pts = anchors(roles);
    if (pts.length) score -= Math.min(distanceToNearest(pos, pts), cap) * weight;
  };
  if (role === 'plates' || role === 'barbell' || role === 'bench') pull(['rack'], 6);
  if (role === 'small') pull(['storage', 'rack'], 4);
  if (role === 'storage') pull(['rack', 'machine'], 2);
  if (role === 'cardio') pull(['cardio'], 3, 4);
  if (role === 'machine') pull(['rack'], 1.5);

  // Buren op een logische tussenafstand: liever aansluitend dan met een smalle kier.
  for (const other of ctx.placed) {
    const a = aabbOf(c.box);
    const b = aabbOf(other.box);
    const gapX = Math.max(b.minX - a.maxX, a.minX - b.maxX);
    const gapZ = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ);
    const gap = Math.max(gapX, gapZ);
    if (gap > 0.08 && gap < 0.4 && Math.min(gapX, gapZ) < 0) score -= 4;
  }

  return score + rng() * 3;
}

/**
 * Vrije ruimte die het toestel nodig heeft aan de kant die naar de gegeven muur wijst.
 * Lokale zijden bij rotatie 0: achter → achterwand, rechts → rechterwand, voor → voorwand, links → linkerwand;
 * elke 90° (tegen de klok in, van bovenaf) schuift dat één muur op.
 */
function clearanceTowards(product: LayoutProduct, rotationDeg: number, wall: WallId): number {
  const c = product.spec.clearance;
  if (!c) return 0;
  // Bij rotatie 0 wijzen [achter, rechts, voor, links] naar [achterwand, rechterwand, voorwand, linkerwand].
  const facing = [c.back, c.right, c.front, c.left];
  const turns = ((Math.round(rotationDeg / 90) % 4) + 4) % 4;
  return facing[(WALLS.indexOf(wall) + turns) % 4];
}

function wallCandidates(product: LayoutProduct, room: Room, index: number): { entry: Entry; wall: WallId | null }[] {
  const out: { entry: Entry; wall: WallId | null }[] = [];
  const step = 0.1;
  for (const rotationDeg of [0, 90, 180, 270]) {
    const { hx, hz } = rotatedHalfExtents(product.dimensions, rotationDeg);
    if (hx * 2 > room.width - 2 * WALL_GAP || hz * 2 > room.length - 2 * WALL_GAP) continue;
    for (const wall of WALLS) {
      // Afstand tot de muur: strak ertegen, of zo ver ervan af als de gebruiksruimte aan die kant vraagt.
      const gap = Math.max(WALL_GAP, clearanceTowards(product, rotationDeg, wall));
      if (wall === 'north' || wall === 'south') {
        const z = wall === 'north' ? hz + gap : room.length - hz - gap;
        const from = hx + WALL_GAP;
        const to = room.width - hx - WALL_GAP;
        for (let x = from; x <= to + 1e-9; x += step) out.push({ entry: makeEntry(product, { x, z, y: 0, rotationDeg }, index), wall });
        out.push({ entry: makeEntry(product, { x: to, z, y: 0, rotationDeg }, index), wall });
      } else {
        const x = wall === 'west' ? hx + gap : room.width - hx - gap;
        const from = hz + WALL_GAP;
        const to = room.length - hz - WALL_GAP;
        for (let z = from; z <= to + 1e-9; z += step) out.push({ entry: makeEntry(product, { x, z, y: 0, rotationDeg }, index), wall });
        out.push({ entry: makeEntry(product, { x, z: to, y: 0, rotationDeg }, index), wall });
      }
    }
  }
  return out;
}

function interiorCandidates(product: LayoutProduct, room: Room, index: number): { entry: Entry; wall: WallId | null }[] {
  const out: { entry: Entry; wall: WallId | null }[] = [];
  const step = 0.25;
  for (const rotationDeg of [0, 90]) {
    const { hx, hz } = rotatedHalfExtents(product.dimensions, rotationDeg);
    for (let x = hx + 0.3; x <= room.width - hx - 0.3 + 1e-9; x += step) {
      for (let z = hz + 0.3; z <= room.length - hz - 0.3 + 1e-9; z += step) {
        out.push({ entry: makeEntry(product, { x, z, y: 0, rotationDeg }, index), wall: null });
      }
    }
  }
  return out;
}

/** Bank midden in het rek, met het voeteneinde naar voren uitstekend. */
function tryBenchInRack(product: LayoutProduct, ctx: Context, index: number): Entry | null {
  for (const rack of ctx.placed) {
    const anchors = rack.product.anchors;
    if (rack.product.role !== 'rack' || !anchors) continue;
    const lz = anchors.benchBackZ + product.dimensions.depth / 2;
    const p = localToWorld(0, lz, rack.item.x, rack.item.z, rack.item.rotationDeg);
    const entry = makeEntry(product, { x: p.x, z: p.z, y: 0, rotationDeg: rack.item.rotationDeg }, index);
    if (isValid(entry, ctx, false)) return entry;
  }
  return null;
}

/** Halterstang op de J-cups van het rek, mits de stang binnen de muren blijft. */
function tryBarOnRack(product: LayoutProduct, ctx: Context, index: number): Entry | null {
  for (const rack of ctx.placed) {
    const anchors = rack.product.anchors;
    if (rack.product.role !== 'rack' || !anchors) continue;
    const p = localToWorld(0, anchors.barZ, rack.item.x, rack.item.z, rack.item.rotationDeg);
    const entry = makeEntry(product, { x: p.x, z: p.z, y: anchors.barY, rotationDeg: rack.item.rotationDeg }, index);
    if (outsideRoomDistance(entry.box, ctx.room) > 0.001) continue;
    const others = ctx.placed.filter((e) => e !== rack);
    const clash = others.some((o) => o.parts.some((q) => entry.parts.some((p2) => penetration3D(p2, q) > 0.005)));
    const hitsObstacle = ctx.obstacleBoxes.some((o) => penetration3D(entry.box, o) > 0.005);
    if (!clash && !hitsObstacle) return entry;
  }
  return null;
}

function runAttempt(req: LayoutRequest, rng: () => number): LayoutResult {
  const { room } = req;
  const doors = req.openings.filter((o) => o.kind === 'door');
  const ctx: Context = {
    room,
    doorZones: doors.map((d) => doorZoneBox(room, d)),
    doorCentres: doors.map((d) => {
      const f = wallFrame(room, d.wall);
      const mid = d.offset + d.width / 2;
      return { x: f.start.x + f.along.x * mid, z: f.start.z + f.along.z * mid };
    }),
    obstacleBoxes: req.obstacles.map(obstacleBox),
    windowSpans: req.openings.filter((o) => o.kind === 'window').map((w) => ({ wall: w.wall, from: w.offset, to: w.offset + w.width })),
    placed: [],
  };
  const skipped: LayoutSkip[] = [];
  let total = 0;

  req.products.forEach((product, index) => {
    const weight = Math.max(40, 160 - index * 10); // belangrijke producten wegen zwaarder
    if (product.dimensions.height > room.height + 0.001) {
      skipped.push({ productId: product.productId, label: product.label, reason: 'te hoog voor het plafond' });
      total -= weight;
      return;
    }

    let chosen: Entry | null = null;
    let chosenScore = 0;

    if (product.role === 'bench') chosen = tryBenchInRack(product, ctx, index);
    if (product.role === 'barbell') chosen = tryBarOnRack(product, ctx, index);
    if (chosen) chosenScore = 25;

    if (!chosen) {
      const candidates = [...wallCandidates(product, room, index), ...interiorCandidates(product, room, index)];
      let bestScore = -Infinity;
      for (const cand of candidates) {
        if (!isValid(cand.entry, ctx, true)) continue;
        const s = scoreCandidate(cand.entry, cand.wall, ctx, rng);
        if (s > bestScore) {
          chosen = cand.entry;
          bestScore = s;
        }
      }
      chosenScore = bestScore;
    }

    if (!chosen) {
      skipped.push({ productId: product.productId, label: product.label, reason: 'geen plek met voldoende vrije ruimte' });
      total -= weight;
      return;
    }
    ctx.placed.push(chosen);
    total += weight + chosenScore;
  });

  return {
    items: ctx.placed.map((e) => ({
      ...e.item,
      x: Math.round(e.item.x * 1000) / 1000,
      z: Math.round(e.item.z * 1000) / 1000,
    })),
    skipped,
    score: total,
  };
}

/** Genereert een voorbeeldindeling. Zelfde seed + zelfde invoer = zelfde resultaat. */
export function generateLayout(req: LayoutRequest): LayoutResult {
  const attempts = Math.max(1, req.attempts ?? 8);
  let best: LayoutResult | null = null;
  for (let i = 0; i < attempts; i++) {
    const result = runAttempt(req, createRng(req.seed * 7919 + i * 104729 + 1));
    if (!best || result.score > best.score) best = result;
  }
  return best!;
}
