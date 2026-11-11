import type { Design, Dimensions, PlacedItem, Room, SpecLookup, WallId } from '../types';
import {
  doorZoneBox,
  fullLocalBox,
  normalizeDeg,
  obstacleBox,
  orientedBoxFromLocal,
  outsideRoomDistance,
  penetration2D,
  penetration3D,
  rotatedHalfExtents,
  type Vec2,
} from './shapes';
import { itemParts } from './validation';

/** Rotatie waarbij de achterzijde (lokale −z) naar de gegeven muur wijst. */
export const ROTATION_BACK_TO_WALL: Record<WallId, number> = {
  north: 0,
  west: 90,
  south: 180,
  east: 270,
};

export function nearestWall(pos: Vec2, room: Pick<Room, 'width' | 'length'>): WallId {
  const dist: [WallId, number][] = [
    ['north', pos.z],
    ['south', room.length - pos.z],
    ['west', pos.x],
    ['east', room.width - pos.x],
  ];
  dist.sort((a, b) => a[1] - b[1]);
  return dist[0][0];
}

/**
 * Zet een apparaat met de achterzijde strak tegen een muur.
 * De positie langs de muur blijft behouden (maar binnen de ruimte geklemd).
 */
export function placeAgainstWall(
  item: Pick<PlacedItem, 'x' | 'z' | 'dimensions'>,
  wall: WallId,
  room: Pick<Room, 'width' | 'length'>,
): { x: number; z: number; rotationDeg: number } {
  const rotationDeg = ROTATION_BACK_TO_WALL[wall];
  const { hx, hz } = rotatedHalfExtents(item.dimensions, rotationDeg);
  const clampX = (x: number) => Math.min(Math.max(x, hx), Math.max(hx, room.width - hx));
  const clampZ = (z: number) => Math.min(Math.max(z, hz), Math.max(hz, room.length - hz));
  switch (wall) {
    case 'north':
      return { x: clampX(item.x), z: hz, rotationDeg };
    case 'south':
      return { x: clampX(item.x), z: room.length - hz, rotationDeg };
    case 'west':
      return { x: hx, z: clampZ(item.z), rotationDeg };
    case 'east':
      return { x: room.width - hx, z: clampZ(item.z), rotationDeg };
  }
}

/**
 * Zoekt een vrije plek voor een nieuw apparaat: zo dicht mogelijk bij het midden van de ruimte,
 * zonder overlap met bestaande apparaten, obstakels of deurzones.
 * Vindt het niets, dan wordt het midden teruggegeven (de ruimtecontrole meldt dan de overlap).
 */
export function findFreeSpot(design: Design, dims: Dimensions, specOf: SpecLookup, rotationDeg = 0): Vec2 {
  const { room } = design;
  const centre = { x: room.width / 2, z: room.length / 2 };
  const { hx, hz } = rotatedHalfExtents(dims, rotationDeg);
  const occupied = [
    ...design.items.flatMap((i) => itemParts(i, specOf(i))),
    ...design.obstacles.map(obstacleBox),
  ];
  const doors = design.openings.filter((o) => o.kind === 'door').map((o) => doorZoneBox(room, o));

  const fits = (p: Vec2) => {
    const box = orientedBoxFromLocal(fullLocalBox(dims), { x: p.x, z: p.z, y: 0, rotationDeg });
    if (outsideRoomDistance(box, room) > 0.001) return false;
    if (occupied.some((o) => penetration3D(box, o) > 0.005)) return false;
    if (doors.some((d) => penetration2D(box, d) > 0.02)) return false;
    return true;
  };

  if (fits(centre)) return centre;

  const step = 0.2;
  const candidates: Vec2[] = [];
  for (let x = hx; x <= room.width - hx + 1e-9; x += step) {
    for (let z = hz; z <= room.length - hz + 1e-9; z += step) candidates.push({ x, z });
  }
  candidates.sort(
    (a, b) => Math.hypot(a.x - centre.x, a.z - centre.z) - Math.hypot(b.x - centre.x, b.z - centre.z),
  );
  return candidates.find(fits) ?? centre;
}

export function rotateBy(current: number, delta: number): number {
  return normalizeDeg(Math.round((current + delta) * 100) / 100);
}
