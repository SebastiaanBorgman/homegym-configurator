import { describe, expect, it } from 'vitest';
import { openRackParts } from '../../catalog/collision';
import type { Design, Dimensions, Obstacle, Opening, PhysicalSpec, PlacedItem } from '../types';
import { findFreeSpot, nearestWall, placeAgainstWall, rotateBy } from './placement';
import {
  aabbOf,
  corners,
  doorZoneBox,
  itemBox,
  localToWorld,
  normalizeDeg,
  outsideRoomDistance,
  penetration2D,
  penetration3D,
  rotatedHalfExtents,
  worldToLocal,
  type OrientedBox,
} from './shapes';
import { snapAngle, snapPosition, type SnapOptions } from './snapping';
import { validateDesign, worstSeverityByItem } from './validation';

const ROOM = { width: 4, length: 6, height: 2.6, floor: 'rubber' as const, wallColor: '#ffffff' };

let counter = 0;
function item(dims: Dimensions, x: number, z: number, rotationDeg = 0, extra: Partial<PlacedItem> = {}): PlacedItem {
  counter += 1;
  return { id: `i${counter}`, productId: `p${counter}`, label: `Item ${counter}`, dimensions: dims, x, z, y: 0, rotationDeg, ...extra };
}

function design(items: PlacedItem[], extra: Partial<Design> = {}): Design {
  return {
    schemaVersion: 1,
    id: 'd',
    name: 'test',
    createdAt: '',
    updatedAt: '',
    room: ROOM,
    openings: [],
    obstacles: [],
    items,
    ...extra,
  };
}

const solid: PhysicalSpec = { name: 'blok', mobility: 'fixed' };
const solidSpec = () => solid;
const box = (cx: number, cz: number, w: number, d: number, rot = 0, y0 = 0, y1 = 1): OrientedBox => ({
  cx,
  cz,
  hw: w / 2,
  hd: d / 2,
  rotationDeg: rot,
  y0,
  y1,
});

describe('rotatie en coördinaten', () => {
  it('normaliseert hoeken naar [0, 360)', () => {
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(450)).toBe(90);
    expect(normalizeDeg(360)).toBe(0);
    expect(rotateBy(350, 15)).toBe(5);
  });

  it('draait volgens de three.js-conventie (rotation.y): +90° brengt lokale +x naar −z', () => {
    const p = localToWorld(1, 0, 0, 0, 90);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.z).toBeCloseTo(-1, 9);
    const front = localToWorld(0, 1, 0, 0, 90); // voorzijde (+z) wijst na +90° naar +x
    expect(front.x).toBeCloseTo(1, 9);
    expect(front.z).toBeCloseTo(0, 9);
  });

  it('worldToLocal is de inverse van localToWorld', () => {
    const w = localToWorld(0.3, -0.7, 2, 3, 37);
    const l = worldToLocal(w.x, w.z, 2, 3, 37);
    expect(l.x).toBeCloseTo(0.3, 9);
    expect(l.z).toBeCloseTo(-0.7, 9);
  });

  it('een gedraaid apparaat behoudt zijn werkelijke afmetingen', () => {
    const dims = { width: 1.219, depth: 1.245, height: 2.343 };
    for (const rot of [0, 17, 45, 90, 133.5, 270]) {
      const c = corners(itemBox(item(dims, 2, 3, rot)));
      const edgeA = Math.hypot(c[1].x - c[0].x, c[1].z - c[0].z);
      const edgeB = Math.hypot(c[2].x - c[1].x, c[2].z - c[1].z);
      expect(edgeA).toBeCloseTo(dims.width, 9);
      expect(edgeB).toBeCloseTo(dims.depth, 9);
    }
  });

  it('berekent de omhullende van een gedraaide voetafdruk', () => {
    const d = { width: 2, depth: 1, height: 1 };
    expect(rotatedHalfExtents(d, 0)).toEqual({ hx: 1, hz: 0.5 });
    const r90 = rotatedHalfExtents(d, 90);
    expect(r90.hx).toBeCloseTo(0.5, 9);
    expect(r90.hz).toBeCloseTo(1, 9);
    const r45 = rotatedHalfExtents(d, 45);
    expect(r45.hx).toBeCloseTo((1 + 0.5) * Math.SQRT1_2, 9);
    const a = aabbOf(box(0, 0, 2, 1, 45));
    expect(a.maxX).toBeCloseTo(r45.hx, 9);
  });
});

describe('overlapdetectie (SAT)', () => {
  it('herkent overlappende en losse rechthoeken', () => {
    expect(penetration2D(box(0, 0, 1, 1), box(0.5, 0, 1, 1))).toBeCloseTo(0.5, 9);
    expect(penetration2D(box(0, 0, 1, 1), box(1.5, 0, 1, 1))).toBe(0);
  });

  it('telt strak tegen elkaar staan niet als overlap', () => {
    expect(penetration2D(box(0, 0, 1, 1), box(1, 0, 1, 1))).toBe(0);
  });

  it('is correct voor gedraaide apparaten waar de omhullenden wél overlappen', () => {
    // Twee evenwijdige diagonale balken: hun as-parallelle omhullenden overlappen, de balken zelf niet.
    const a = box(0, 0, 3, 0.4, 45);
    const b = box(1.0, 1.0, 3, 0.4, 45);
    const A = aabbOf(a);
    const B = aabbOf(b);
    expect(A.maxX > B.minX && A.maxZ > B.minZ).toBe(true);
    expect(penetration2D(a, b)).toBe(0);
    // Kruisende balken overlappen wel.
    expect(penetration2D(box(0, 0, 3, 0.4, 45), box(0, 0, 3, 0.4, -45))).toBeGreaterThan(0.3);
  });

  it('houdt rekening met de hoogte', () => {
    const low = box(0, 0, 1, 1, 0, 0, 0.5);
    const high = box(0, 0, 1, 1, 0, 1.2, 1.3);
    expect(penetration3D(low, high)).toBe(0);
    expect(penetration3D(low, box(0, 0, 1, 1, 0, 0.4, 1))).toBeCloseTo(0.1, 9);
  });

  it('meet hoe ver een voetafdruk buiten de ruimte steekt', () => {
    expect(outsideRoomDistance(box(2, 3, 1, 1), ROOM)).toBe(0);
    expect(outsideRoomDistance(box(0.5, 3, 1, 1), ROOM)).toBeCloseTo(0, 9); // precies tegen de muur
    expect(outsideRoomDistance(box(0.3, 3, 1, 1), ROOM)).toBeCloseTo(0.2, 9);
    expect(outsideRoomDistance(box(3.9, 3, 1, 1), ROOM)).toBeCloseTo(0.4, 9);
  });
});

describe('ruimtecontrole', () => {
  const rack = { width: 1.2, depth: 1.2, height: 2.3 };

  it('geeft geen meldingen voor een apparaat dat past', () => {
    expect(validateDesign(design([item(rack, 2, 3)]), solidSpec)).toEqual([]);
  });

  it('accepteert een apparaat dat strak tegen de muur staat', () => {
    expect(validateDesign(design([item(rack, 0.6, 0.6)]), solidSpec)).toEqual([]);
  });

  it('meldt een apparaat dat door een muur steekt', () => {
    const issues = validateDesign(design([item(rack, 0.4, 3)]), solidSpec);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('OUT_OF_ROOM');
    expect(issues[0].severity).toBe('error');
    expect(issues[0].detail).toContain('linkerwand');
    expect(issues[0].detail).toContain('20');
  });

  it('meldt een gedraaid apparaat dat alleen door de draaiing niet meer past', () => {
    const long = { width: 2, depth: 1, height: 1 };
    expect(validateDesign(design([item(long, 1.0, 3, 0)]), solidSpec)).toEqual([]);
    const rotated = validateDesign(design([item(long, 1.0, 3, 45)]), solidSpec);
    expect(rotated.map((i) => i.code)).toEqual(['OUT_OF_ROOM']);
  });

  it('herkent overlappende apparaten en negeert rakende apparaten', () => {
    const a = item(rack, 1, 3);
    const overlapping = item(rack, 1.9, 3);
    const touching = item(rack, 2.2, 3);
    expect(validateDesign(design([a, overlapping]), solidSpec).map((i) => i.code)).toEqual(['OVERLAP']);
    expect(validateDesign(design([a, touching]), solidSpec)).toEqual([]);
  });

  it('herkent overlap correct bij gedraaide apparaten', () => {
    const bar = { width: 3, depth: 0.4, height: 1 };
    const parallel = [item(bar, 1.5, 2, 45), item(bar, 2.5, 3, 45)];
    expect(validateDesign(design(parallel), solidSpec)).toEqual([]);
    const crossing = [item(bar, 2, 3, 45), item(bar, 2, 3, -45)];
    expect(validateDesign(design(crossing), solidSpec).map((i) => i.code)).toEqual(['OVERLAP']);
  });

  it('herkent een apparaat dat te hoog is voor het plafond', () => {
    const tall = item({ width: 1, depth: 1, height: 2.7 }, 2, 3);
    const issues = validateDesign(design([tall]), solidSpec);
    expect(issues.map((i) => i.code)).toEqual(['CEILING']);
    expect(issues[0].detail).toContain('10');
    // Precies passend is goed.
    expect(validateDesign(design([item({ width: 1, depth: 1, height: 2.6 }, 2, 3)]), solidSpec)).toEqual([]);
    // Ook een verhoogd geplaatst accessoire telt mee.
    const raised = item({ width: 1, depth: 0.1, height: 0.1 }, 2, 3, 0, { y: 2.55 });
    expect(validateDesign(design([raised]), solidSpec).map((i) => i.code)).toEqual(['CEILING']);
  });

  it('controleert obstakels, inclusief hun hoogte', () => {
    const pillar: Obstacle = { id: 'o1', name: 'Pilaar', x: 2, z: 3, width: 0.3, depth: 0.3, height: 2.6, rotationDeg: 0 };
    const hit = validateDesign(design([item(rack, 2.3, 3)], { obstacles: [pillar] }), solidSpec);
    expect(hit.map((i) => i.code)).toEqual(['OBSTACLE']);
    const clear = validateDesign(design([item(rack, 3.2, 3)], { obstacles: [pillar] }), solidSpec);
    expect(clear).toEqual([]);
    // Een laag obstakel onder een verhoogd geplaatst object raakt niets.
    const low: Obstacle = { ...pillar, height: 0.3 };
    const above = item({ width: 1, depth: 1, height: 0.2 }, 2, 3, 0, { y: 1 });
    expect(validateDesign(design([above], { obstacles: [low] }), solidSpec)).toEqual([]);
  });

  it('laat een bank toe tussen de staanders van een open rek', () => {
    const rackDims = { width: 1.2192, depth: 1.2446, height: 2.34315 };
    const rackItem = item(rackDims, 2, 1, 0);
    const bench = item({ width: 0.63, depth: 1.43, height: 0.45 }, 2, 1.3, 0);
    const specOf = (i: PlacedItem): PhysicalSpec =>
      i.id === rackItem.id
        ? { name: 'rek', mobility: 'fixed', collisionParts: openRackParts(rackDims, 0.076) }
        : { name: 'bank', mobility: 'movable' };
    expect(validateDesign(design([rackItem, bench]), specOf)).toEqual([]);
    // Verschuif de bank tot hij een staander raakt: nu wél overlap.
    const shifted = { ...bench, x: 2.4 };
    expect(validateDesign(design([rackItem, shifted]), specOf).map((i) => i.code)).toEqual(['OVERLAP']);
    // Als massief blok zou dezelfde opstelling een overlap zijn.
    expect(validateDesign(design([rackItem, bench]), solidSpec).map((i) => i.code)).toEqual(['OVERLAP']);
  });

  it('behandelt overlap met losse accessoires als aandachtspunt, niet als fout', () => {
    const a = item(rack, 2, 3);
    const bar = item({ width: 2.2, depth: 0.05, height: 0.05 }, 2, 3, 0, { y: 1.25 });
    const specOf = (i: PlacedItem): PhysicalSpec => (i.id === bar.id ? { name: 'stang', mobility: 'portable' } : solid);
    const issues = validateDesign(design([a, bar]), specOf);
    expect(issues.map((i) => [i.code, i.severity])).toEqual([['LOOSE_OVERLAP', 'info']]);
  });

  it('waarschuwt wanneer een deur wordt geblokkeerd', () => {
    const door: Opening = { id: 'd1', kind: 'door', wall: 'west', offset: 2, width: 0.9, height: 2.1, sill: 0, swing: 'in' };
    const zone = doorZoneBox(ROOM, door);
    expect(zone.cx).toBeCloseTo(0.45, 9);
    expect(zone.cz).toBeCloseTo(2.45, 9);
    const blocked = validateDesign(design([item(rack, 0.6, 2.4)], { openings: [door] }), solidSpec);
    expect(blocked.map((i) => [i.code, i.severity])).toEqual([['DOOR', 'warning']]);
    const free = validateDesign(design([item(rack, 0.6, 4.2)], { openings: [door] }), solidSpec);
    expect(free).toEqual([]);
  });

  it('waarschuwt wanneer de gebruiksruimte wordt beperkt', () => {
    const spec: PhysicalSpec = {
      name: 'loopband',
      mobility: 'fixed',
      clearance: { front: 2, back: 0, left: 0, right: 0, source: 'indicative', note: '' },
    };
    const treadmill = item({ width: 0.8, depth: 1.7, height: 1.3 }, 2, 0.85, 0);
    // 2 m vrij achter de band: past in een ruimte van 6 m lang.
    expect(validateDesign(design([treadmill]), () => spec)).toEqual([]);
    // Omgedraaid wijst de gebruiksruimte door de achterwand.
    const turned = { ...treadmill, rotationDeg: 180 };
    const issues = validateDesign(design([turned]), () => spec);
    expect(issues.map((i) => [i.code, i.severity])).toEqual([['CLEARANCE', 'warning']]);
    expect(issues[0].detail).toContain('Indicatieve');
    // Een vast toestel in de gebruiksruimte geeft ook een waarschuwing.
    const blocker = item(rack, 2, 2.6);
    const specOf = (i: PlacedItem) => (i.id === blocker.id ? solid : spec);
    expect(validateDesign(design([treadmill, blocker]), specOf).map((i) => i.code)).toEqual(['CLEARANCE']);
  });

  it('bepaalt de zwaarste melding per apparaat', () => {
    const a = item(rack, 0.4, 3);
    const b = item(rack, 1.2, 3);
    const map = worstSeverityByItem(validateDesign(design([a, b]), solidSpec));
    expect(map.get(a.id)).toBe('error');
    expect(map.get(b.id)).toBe('error');
  });
});

describe('magnetisch uitlijnen', () => {
  const opt: SnapOptions = { walls: true, objects: true, grid: false, gridSize: 0.25, threshold: 0.12 };
  const dims = { width: 1.2, depth: 0.6, height: 1 };

  it('trekt een apparaat tegen de muur binnen de vangafstand', () => {
    const r = snapPosition(dims, 0, { x: 0.68, z: 3 }, ROOM, [], opt);
    expect(r.x).toBeCloseTo(0.6, 9);
    expect(r.z).toBe(3);
    expect(r.guides).toEqual([{ axis: 'x', value: 0, kind: 'wall' }]);
  });

  it('laat de positie ongemoeid buiten de vangafstand', () => {
    const r = snapPosition(dims, 0, { x: 1.0, z: 3 }, ROOM, [], opt);
    expect(r).toEqual({ x: 1.0, z: 3, guides: [] });
  });

  it('gebruikt de gedraaide voetafdruk', () => {
    const r = snapPosition(dims, 90, { x: 0.35, z: 5.45 }, ROOM, [], opt);
    expect(r.x).toBeCloseTo(0.3, 9); // diepte 0,6 staat nu langs x
    expect(r.z).toBeCloseTo(5.4, 9); // breedte 1,2 staat nu langs z
  });

  it('lijnt uit tegen een naastgelegen object', () => {
    const neighbour = { minX: 1, maxX: 2, minZ: 2.5, maxZ: 3.5 };
    const r = snapPosition(dims, 0, { x: 2.65, z: 3 }, ROOM, [neighbour], opt);
    expect(r.x).toBeCloseTo(2.6, 9);
    expect(r.guides[0]).toEqual({ axis: 'x', value: 2, kind: 'object' });
  });

  it('valt terug op het raster wanneer dat aan staat', () => {
    const r = snapPosition(dims, 0, { x: 1.93, z: 3.02 }, ROOM, [], { ...opt, walls: false, objects: false, grid: true });
    expect(r.x - 0.6).toBeCloseTo(1.25, 9); // linkerrand op het raster
    expect(r.z - 0.3).toBeCloseTo(2.75, 9);
  });

  it('rondt hoeken af op een stapgrootte', () => {
    expect(snapAngle(38, 15)).toBe(45);
    expect(snapAngle(7, 15)).toBe(0);
  });
});

describe('plaatsingshulpen', () => {
  const dims = { width: 1.2, depth: 0.6, height: 1 };

  it('vindt de dichtstbijzijnde muur', () => {
    expect(nearestWall({ x: 0.5, z: 3 }, ROOM)).toBe('west');
    expect(nearestWall({ x: 2, z: 5.5 }, ROOM)).toBe('south');
  });

  it('zet een apparaat met de achterzijde tegen elke muur, binnen de ruimte', () => {
    for (const wall of ['north', 'east', 'south', 'west'] as const) {
      const placed = placeAgainstWall({ x: 2, z: 3, dimensions: dims }, wall, ROOM);
      const it = item(dims, placed.x, placed.z, placed.rotationDeg);
      expect(outsideRoomDistance(itemBox(it), ROOM)).toBeCloseTo(0, 9);
      // De achterzijde (lokale −z) raakt de muur.
      const back = localToWorld(0, -dims.depth / 2, placed.x, placed.z, placed.rotationDeg);
      const distance = { north: back.z, south: ROOM.length - back.z, west: back.x, east: ROOM.width - back.x }[wall];
      expect(distance).toBeCloseTo(0, 9);
    }
  });

  it('zoekt een vrije plek voor een nieuw apparaat', () => {
    const big = { width: 2, depth: 2, height: 2 };
    const existing = item(big, 2, 3);
    const spot = findFreeSpot(design([existing]), big, solidSpec);
    const added = item(big, spot.x, spot.z);
    expect(validateDesign(design([existing, added]), solidSpec)).toEqual([]);
  });
});
