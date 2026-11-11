import type { Dimensions, LocalBox, Obstacle, Opening, PlacedItem, Room, WallId } from '../types';

/** Punt in het vloervlak. */
export interface Vec2 {
  x: number;
  z: number;
}

/** Georiënteerd blok: rechthoek in het vloervlak (gedraaid om y) met een verticaal bereik. */
export interface OrientedBox {
  cx: number;
  cz: number;
  /** Halve breedte langs de lokale x-as. */
  hw: number;
  /** Halve diepte langs de lokale z-as. */
  hd: number;
  rotationDeg: number;
  y0: number;
  y1: number;
}

export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Pose {
  x: number;
  z: number;
  y: number;
  rotationDeg: number;
}

export const degToRad = (deg: number) => (deg * Math.PI) / 180;
export const radToDeg = (rad: number) => (rad * 180) / Math.PI;

/** Normaliseert een hoek naar [0, 360). */
export function normalizeDeg(deg: number): number {
  const n = deg % 360;
  const r = n < 0 ? n + 360 : n;
  return Math.abs(r - 360) < 1e-9 ? 0 : r;
}

/**
 * Lokale apparaat-coördinaat → ruimte-coördinaat.
 * Zelfde conventie als three.js `rotation.y`: positieve hoek draait tegen de klok in (bovenaanzicht).
 */
export function localToWorld(lx: number, lz: number, cx: number, cz: number, rotationDeg: number): Vec2 {
  const r = degToRad(rotationDeg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: cx + lx * c + lz * s, z: cz - lx * s + lz * c };
}

export function worldToLocal(x: number, z: number, cx: number, cz: number, rotationDeg: number): Vec2 {
  const r = degToRad(rotationDeg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = x - cx;
  const dz = z - cz;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

export function fullLocalBox(d: Dimensions): LocalBox {
  return { x0: -d.width / 2, x1: d.width / 2, z0: -d.depth / 2, z1: d.depth / 2, y0: 0, y1: d.height };
}

export function orientedBoxFromLocal(box: LocalBox, pose: Pose): OrientedBox {
  const centre = localToWorld((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2, pose.x, pose.z, pose.rotationDeg);
  return {
    cx: centre.x,
    cz: centre.z,
    hw: (box.x1 - box.x0) / 2,
    hd: (box.z1 - box.z0) / 2,
    rotationDeg: pose.rotationDeg,
    y0: pose.y + box.y0,
    y1: pose.y + box.y1,
  };
}

/** Het omhullende blok van een geplaatst apparaat. */
export function itemBox(item: PlacedItem): OrientedBox {
  return orientedBoxFromLocal(fullLocalBox(item.dimensions), item);
}

export function obstacleBox(o: Obstacle): OrientedBox {
  return { cx: o.x, cz: o.z, hw: o.width / 2, hd: o.depth / 2, rotationDeg: o.rotationDeg, y0: 0, y1: o.height };
}

/** Hoekpunten van de voetafdruk, tegen de klok in. */
export function corners(b: OrientedBox): [Vec2, Vec2, Vec2, Vec2] {
  return [
    localToWorld(-b.hw, -b.hd, b.cx, b.cz, b.rotationDeg),
    localToWorld(b.hw, -b.hd, b.cx, b.cz, b.rotationDeg),
    localToWorld(b.hw, b.hd, b.cx, b.cz, b.rotationDeg),
    localToWorld(-b.hw, b.hd, b.cx, b.cz, b.rotationDeg),
  ];
}

export function aabbOf(b: OrientedBox): Aabb {
  const r = degToRad(b.rotationDeg);
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const ex = b.hw * c + b.hd * s;
  const ez = b.hw * s + b.hd * c;
  return { minX: b.cx - ex, maxX: b.cx + ex, minZ: b.cz - ez, maxZ: b.cz + ez };
}

/** Halve afmetingen van de as-parallelle omhullende van een gedraaide voetafdruk. */
export function rotatedHalfExtents(d: Dimensions, rotationDeg: number): { hx: number; hz: number } {
  const r = degToRad(rotationDeg);
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { hx: (d.width / 2) * c + (d.depth / 2) * s, hz: (d.width / 2) * s + (d.depth / 2) * c };
}

function axesOf(b: OrientedBox): [Vec2, Vec2] {
  const r = degToRad(b.rotationDeg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  // lokale x-as en lokale z-as in ruimte-coördinaten
  return [
    { x: c, z: -s },
    { x: s, z: c },
  ];
}

function projectionRadius(b: OrientedBox, axis: Vec2): number {
  const [ax, az] = axesOf(b);
  return b.hw * Math.abs(ax.x * axis.x + ax.z * axis.z) + b.hd * Math.abs(az.x * axis.x + az.z * axis.z);
}

/**
 * Indringdiepte van twee georiënteerde rechthoeken in het vloervlak (Separating Axis Theorem).
 * Geeft 0 terug als ze elkaar niet overlappen; anders de kleinste overlap in meters.
 */
export function penetration2D(a: OrientedBox, b: OrientedBox): number {
  const axes = [...axesOf(a), ...axesOf(b)];
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  let min = Infinity;
  for (const axis of axes) {
    const dist = Math.abs(dx * axis.x + dz * axis.z);
    const overlap = projectionRadius(a, axis) + projectionRadius(b, axis) - dist;
    if (overlap <= 0) return 0;
    if (overlap < min) min = overlap;
  }
  return min;
}

export function verticalOverlap(a: OrientedBox, b: OrientedBox): number {
  return Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
}

/**
 * Indringdiepte in 3D: de blokken overlappen alleen als ze elkaar zowel in het vloervlak
 * als in hoogte doorsnijden. Raken (≤ tolerantie) telt niet als overlap.
 */
export function penetration3D(a: OrientedBox, b: OrientedBox): number {
  const v = verticalOverlap(a, b);
  if (v <= 0) return 0;
  const h = penetration2D(a, b);
  if (h <= 0) return 0;
  return Math.min(h, v);
}

/** Hoe ver (in m) een voetafdruk maximaal buiten de ruimte steekt; 0 = volledig binnen. */
export function outsideRoomDistance(b: OrientedBox, room: Pick<Room, 'width' | 'length'>): number {
  const box = aabbOf(b);
  return Math.max(0, -box.minX, box.maxX - room.width, -box.minZ, box.maxZ - room.length);
}

/** Welke muren worden overschreden (voor meldingen). */
export function wallsCrossed(b: OrientedBox, room: Pick<Room, 'width' | 'length'>, tol: number): WallId[] {
  const box = aabbOf(b);
  const out: WallId[] = [];
  if (box.minZ < -tol) out.push('north');
  if (box.maxX > room.width + tol) out.push('east');
  if (box.maxZ > room.length + tol) out.push('south');
  if (box.minX < -tol) out.push('west');
  return out;
}

export function wallLength(room: Pick<Room, 'width' | 'length'>, wall: WallId): number {
  return wall === 'north' || wall === 'south' ? room.width : room.length;
}

/**
 * Beschrijft een muur in het vloervlak: startpunt, richting langs de muur en richting de ruimte in.
 * Openingen (deuren/ramen) worden gemeten vanaf `start` langs `along`.
 */
export function wallFrame(room: Pick<Room, 'width' | 'length'>, wall: WallId): { start: Vec2; along: Vec2; inward: Vec2 } {
  switch (wall) {
    case 'north':
      return { start: { x: 0, z: 0 }, along: { x: 1, z: 0 }, inward: { x: 0, z: 1 } };
    case 'south':
      return { start: { x: 0, z: room.length }, along: { x: 1, z: 0 }, inward: { x: 0, z: -1 } };
    case 'west':
      return { start: { x: 0, z: 0 }, along: { x: 0, z: 1 }, inward: { x: 1, z: 0 } };
    case 'east':
      return { start: { x: room.width, z: 0 }, along: { x: 0, z: 1 }, inward: { x: -1, z: 0 } };
  }
}

/** Diepte (m) van de zone die voor een deur vrij moet blijven. */
export function doorZoneDepth(opening: Opening): number {
  return opening.swing === 'in' ? opening.width : 0.6;
}

/** Vrij te houden zone vóór een deur, als as-parallel blok in de ruimte. */
export function doorZoneBox(room: Pick<Room, 'width' | 'length'>, opening: Opening): OrientedBox {
  const f = wallFrame(room, opening.wall);
  const depth = doorZoneDepth(opening);
  const mid = opening.offset + opening.width / 2;
  const cx = f.start.x + f.along.x * mid + f.inward.x * (depth / 2);
  const cz = f.start.z + f.along.z * mid + f.inward.z * (depth / 2);
  const alongX = f.along.x !== 0;
  return {
    cx,
    cz,
    hw: alongX ? opening.width / 2 : depth / 2,
    hd: alongX ? depth / 2 : opening.width / 2,
    rotationDeg: 0,
    y0: 0,
    y1: opening.height,
  };
}

export function clampOpening(room: Pick<Room, 'width' | 'length' | 'height'>, o: Opening): Opening {
  const len = wallLength(room, o.wall);
  const width = Math.min(Math.max(o.width, 0.4), Math.max(0.4, len - 0.1));
  const offset = Math.min(Math.max(o.offset, 0.05), Math.max(0.05, len - width - 0.05));
  const sill = o.kind === 'door' ? 0 : Math.min(Math.max(o.sill, 0), Math.max(0, room.height - 0.4));
  const height = Math.min(Math.max(o.height, 0.3), Math.max(0.3, room.height - sill - 0.05));
  return { ...o, width, offset, sill, height };
}
