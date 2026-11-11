import type { Dimensions, Room } from '../types';
import { rotatedHalfExtents, type Aabb, type Vec2 } from './shapes';

export interface SnapOptions {
  walls: boolean;
  objects: boolean;
  grid: boolean;
  /** Rastermaat in meters. */
  gridSize: number;
  /** Vangafstand in meters. */
  threshold: number;
}

export interface SnapGuide {
  /** 'x' = verticale hulplijn op x = value; 'z' = horizontale hulplijn op z = value. */
  axis: 'x' | 'z';
  value: number;
  kind: 'wall' | 'object' | 'grid';
}

export interface SnapResult extends Vec2 {
  guides: SnapGuide[];
}

interface Candidate {
  /** Doelpositie voor het middelpunt. */
  centre: number;
  /** Positie van de hulplijn (de rand waarop wordt uitgelijnd). */
  line: number;
  kind: 'wall' | 'object';
}

function pick(proposed: number, candidates: Candidate[], threshold: number): Candidate | null {
  let best: Candidate | null = null;
  let bestDist = threshold;
  for (const c of candidates) {
    // Muren krijgen iets voorrang boven objecten bij gelijke afstand.
    const dist = Math.abs(c.centre - proposed) - (c.kind === 'wall' ? 0.005 : 0);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Magnetisch uitlijnen van een (gedraaide) voetafdruk op muren, andere objecten en het raster.
 * Werkt op de as-parallelle omhullende, zodat het ook bij schuine hoeken klopt:
 * het verste punt van het apparaat komt precies tegen de muur.
 */
export function snapPosition(
  dims: Dimensions,
  rotationDeg: number,
  proposed: Vec2,
  room: Pick<Room, 'width' | 'length'>,
  others: Aabb[],
  opt: SnapOptions,
): SnapResult {
  const { hx, hz } = rotatedHalfExtents(dims, rotationDeg);
  const guides: SnapGuide[] = [];
  const near = 0.35; // objecten tellen alleen mee als ze in de andere richting dichtbij liggen

  const xs: Candidate[] = [];
  const zs: Candidate[] = [];

  if (opt.walls) {
    xs.push({ centre: hx, line: 0, kind: 'wall' }, { centre: room.width - hx, line: room.width, kind: 'wall' });
    zs.push({ centre: hz, line: 0, kind: 'wall' }, { centre: room.length - hz, line: room.length, kind: 'wall' });
  }

  if (opt.objects) {
    for (const o of others) {
      const zNear = proposed.z + hz > o.minZ - near && proposed.z - hz < o.maxZ + near;
      const xNear = proposed.x + hx > o.minX - near && proposed.x - hx < o.maxX + near;
      if (zNear) {
        xs.push(
          { centre: o.maxX + hx, line: o.maxX, kind: 'object' }, // links tegen rechterkant
          { centre: o.minX - hx, line: o.minX, kind: 'object' }, // rechts tegen linkerkant
        );
      }
      if (xNear) {
        zs.push(
          { centre: o.maxZ + hz, line: o.maxZ, kind: 'object' },
          { centre: o.minZ - hz, line: o.minZ, kind: 'object' },
        );
      }
      // Randen in één lijn zetten met een buurobject
      if (xNear && !zNear) {
        xs.push(
          { centre: o.minX + hx, line: o.minX, kind: 'object' },
          { centre: o.maxX - hx, line: o.maxX, kind: 'object' },
        );
      }
      if (zNear && !xNear) {
        zs.push(
          { centre: o.minZ + hz, line: o.minZ, kind: 'object' },
          { centre: o.maxZ - hz, line: o.maxZ, kind: 'object' },
        );
      }
    }
  }

  let x = proposed.x;
  let z = proposed.z;

  const sx = pick(proposed.x, xs, opt.threshold);
  if (sx) {
    x = sx.centre;
    guides.push({ axis: 'x', value: sx.line, kind: sx.kind });
  } else if (opt.grid && opt.gridSize > 0) {
    const edge = Math.round((proposed.x - hx) / opt.gridSize) * opt.gridSize;
    x = edge + hx;
    guides.push({ axis: 'x', value: edge, kind: 'grid' });
  }

  const sz = pick(proposed.z, zs, opt.threshold);
  if (sz) {
    z = sz.centre;
    guides.push({ axis: 'z', value: sz.line, kind: sz.kind });
  } else if (opt.grid && opt.gridSize > 0) {
    const edge = Math.round((proposed.z - hz) / opt.gridSize) * opt.gridSize;
    z = edge + hz;
    guides.push({ axis: 'z', value: edge, kind: 'grid' });
  }

  return { x, z, guides };
}

/** Rondt een hoek af op een veelvoud van `step` graden. */
export function snapAngle(deg: number, step: number): number {
  if (step <= 0) return deg;
  return Math.round(deg / step) * step;
}
