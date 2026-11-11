import type { Design, LocalBox, PhysicalSpec, PlacedItem, SpecLookup } from '../types';
import { WALL_LABELS } from '../types';
import {
  aabbOf,
  doorZoneBox,
  fullLocalBox,
  itemBox,
  obstacleBox,
  orientedBoxFromLocal,
  outsideRoomDistance,
  penetration2D,
  penetration3D,
  wallsCrossed,
  type OrientedBox,
} from './shapes';

export type Severity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'OUT_OF_ROOM'
  | 'CEILING'
  | 'OVERLAP'
  | 'OBSTACLE'
  | 'DOOR'
  | 'CLEARANCE'
  | 'LOOSE_OVERLAP'
  | 'OVERHEAD';

export interface Issue {
  id: string;
  code: IssueCode;
  severity: Severity;
  /** Betrokken apparaten; het eerste is het "hoofd"-apparaat van de melding. */
  itemIds: string[];
  title: string;
  detail: string;
}

/** Toleranties in meters. Raken is toegestaan; pas echte doorsnijding telt. */
export const TOLERANCE = {
  /** Indringing tussen twee objecten die nog als "raken" geldt. */
  contact: 0.005,
  /** Overschrijding van een muur die nog als "tegen de muur" geldt. */
  room: 0.002,
  ceiling: 0.001,
  /** Indringing in een gebruiksruimte of deurzone die wordt genegeerd. */
  zone: 0.02,
} as const;

/** Hoogte (m) tot waar een gebruiksruimte vrij moet zijn. */
const ZONE_HEIGHT = 1.8;
/** Ondergrens voor de vrije ruimte boven toestellen met optrekstang (indicatief). */
const OVERHEAD_MARGIN = 0.3;

const cm = (m: number) => Math.round(m * 100).toLocaleString('nl-NL');
const cm1 = (m: number) => (Math.round(m * 1000) / 10).toLocaleString('nl-NL');

export function itemParts(item: PlacedItem, spec: PhysicalSpec): OrientedBox[] {
  const parts: LocalBox[] = spec.collisionParts?.length ? spec.collisionParts : [fullLocalBox(item.dimensions)];
  return parts.map((p) => orientedBoxFromLocal(p, item));
}

export function hasClearance(spec: PhysicalSpec): boolean {
  const c = spec.clearance;
  return !!c && c.front + c.back + c.left + c.right > 0;
}

/** Gebruiksruimte: de voetafdruk plus de vrije stroken eromheen. */
export function clearanceBox(item: PlacedItem, spec: PhysicalSpec): OrientedBox | null {
  const c = spec.clearance;
  if (!c || !hasClearance(spec)) return null;
  const d = item.dimensions;
  return orientedBoxFromLocal(
    {
      x0: -d.width / 2 - c.left,
      x1: d.width / 2 + c.right,
      z0: -d.depth / 2 - c.back,
      z1: d.depth / 2 + c.front,
      y0: 0,
      y1: Math.min(ZONE_HEIGHT, Math.max(d.height, 0.5)),
    },
    item,
  );
}

function aabbsTouch(a: OrientedBox, b: OrientedBox): boolean {
  const A = aabbOf(a);
  const B = aabbOf(b);
  return A.minX < B.maxX && A.maxX > B.minX && A.minZ < B.maxZ && A.maxZ > B.minZ;
}

function maxPenetration(a: OrientedBox[], b: OrientedBox[]): number {
  let max = 0;
  for (const pa of a) for (const pb of b) max = Math.max(max, penetration3D(pa, pb));
  return max;
}

function joinNl(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} en ${parts[parts.length - 1]}`;
}

/**
 * Ruimtelijke controle van een compleet ontwerp. Puur rekenwerk op de werkelijke maten:
 * geen afhankelijkheid van de 3D-weergave.
 */
export function validateDesign(design: Design, specOf: SpecLookup): Issue[] {
  const issues: Issue[] = [];
  const { room } = design;

  const entries = design.items.map((item) => {
    const spec = specOf(item);
    return { item, spec, box: itemBox(item), parts: itemParts(item, spec), name: item.label || spec.name };
  });
  const obstacles = design.obstacles.map((o) => ({ o, box: obstacleBox(o) }));

  for (const e of entries) {
    // 1. Binnen de muren?
    const out = outsideRoomDistance(e.box, room);
    if (out > TOLERANCE.room) {
      const walls = wallsCrossed(e.box, room, TOLERANCE.room).map((w) => WALL_LABELS[w].toLowerCase());
      issues.push({
        id: `OUT_OF_ROOM:${e.item.id}`,
        code: 'OUT_OF_ROOM',
        severity: 'error',
        itemIds: [e.item.id],
        title: `${e.name} staat buiten de ruimte`,
        detail: `Steekt ${cm1(out)} cm door de ${joinNl(walls)}.`,
      });
    }

    // 2. Past het onder het plafond?
    const top = e.item.y + e.item.dimensions.height;
    if (top > room.height + TOLERANCE.ceiling) {
      issues.push({
        id: `CEILING:${e.item.id}`,
        code: 'CEILING',
        severity: 'error',
        itemIds: [e.item.id],
        title: `${e.name} is te hoog voor deze ruimte`,
        detail: `Bovenkant op ${cm1(top)} cm, plafond op ${cm1(room.height)} cm: ${cm1(top - room.height)} cm te hoog.`,
      });
    } else if (e.spec.overheadUse && room.height - top < OVERHEAD_MARGIN) {
      issues.push({
        id: `OVERHEAD:${e.item.id}`,
        code: 'OVERHEAD',
        severity: 'info',
        itemIds: [e.item.id],
        title: `Weinig ruimte boven ${e.name}`,
        detail: `Nog ${cm1(room.height - top)} cm tot het plafond. Optrekken (pull-ups) kan hier krap zijn — indicatie, geen fabrikantseis.`,
      });
    }

    // 3. Obstakels
    for (const { o, box } of obstacles) {
      if (!aabbsTouch(e.box, box)) continue;
      if (maxPenetration(e.parts, [box]) > TOLERANCE.contact) {
        issues.push({
          id: `OBSTACLE:${e.item.id}:${o.id}`,
          code: 'OBSTACLE',
          severity: 'error',
          itemIds: [e.item.id],
          title: `${e.name} staat in ${o.name}`,
          detail: 'Het apparaat overlapt met een obstakel in de ruimte.',
        });
      }
    }
  }

  // 4. Overlap tussen apparaten
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (!aabbsTouch(a.box, b.box)) continue;
      const pen = maxPenetration(a.parts, b.parts);
      if (pen <= TOLERANCE.contact) continue;
      const loose = a.spec.mobility === 'portable' || b.spec.mobility === 'portable';
      issues.push({
        id: `${loose ? 'LOOSE_OVERLAP' : 'OVERLAP'}:${a.item.id}:${b.item.id}`,
        code: loose ? 'LOOSE_OVERLAP' : 'OVERLAP',
        severity: loose ? 'info' : 'error',
        itemIds: [a.item.id, b.item.id],
        title: loose ? `${a.name} en ${b.name} raken elkaar` : `${a.name} en ${b.name} overlappen`,
        detail: loose
          ? `Los accessoire overlapt ${cm1(pen)} cm — prima als het bewust zo ligt (bijv. stang in het rek).`
          : `De apparaten doorsnijden elkaar ${cm1(pen)} cm.`,
      });
    }
  }

  // 5. Deuren vrijhouden
  for (const opening of design.openings) {
    if (opening.kind !== 'door') continue;
    const zone = doorZoneBox(room, opening);
    for (const e of entries) {
      if (!aabbsTouch(e.box, zone)) continue;
      const blocked = e.parts.some((p) => p.y0 < opening.height && penetration2D(zone, p) > TOLERANCE.zone);
      if (!blocked) continue;
      issues.push({
        id: `DOOR:${e.item.id}:${opening.id}`,
        code: 'DOOR',
        severity: 'warning',
        itemIds: [e.item.id],
        title: `${e.name} blokkeert de deur`,
        detail:
          opening.swing === 'in'
            ? `Staat in het draaibereik van de deur in de ${WALL_LABELS[opening.wall].toLowerCase()}.`
            : `Staat in de doorgang bij de deur in de ${WALL_LABELS[opening.wall].toLowerCase()}.`,
      });
    }
  }

  // 6. Gebruiksruimte
  for (const e of entries) {
    const zone = clearanceBox(e.item, e.spec);
    if (!zone) continue;
    const blockers: string[] = [];
    const itemOutside = outsideRoomDistance(e.box, room) > TOLERANCE.room;
    const zoneOut = outsideRoomDistance(zone, room);
    if (!itemOutside && zoneOut > TOLERANCE.zone) blockers.push(`de muur (${cm(zoneOut)} cm te weinig)`);
    for (const other of entries) {
      if (other === e || other.spec.mobility !== 'fixed') continue;
      if (!aabbsTouch(zone, other.box)) continue;
      if (maxPenetration([zone], other.parts) > TOLERANCE.zone) blockers.push(other.name);
    }
    for (const { o, box } of obstacles) {
      if (penetration3D(zone, box) > TOLERANCE.zone) blockers.push(o.name);
    }
    if (blockers.length) {
      const manufacturer = e.spec.clearance?.source === 'manufacturer';
      issues.push({
        id: `CLEARANCE:${e.item.id}`,
        code: 'CLEARANCE',
        severity: 'warning',
        itemIds: [e.item.id],
        title: `Gebruiksruimte van ${e.name} is beperkt`,
        detail: `Beperkt door ${joinNl(blockers)}. ${
          manufacturer ? 'Vrije ruimte volgens opgave van de fabrikant.' : 'Indicatieve vrije ruimte — geen officiële veiligheidseis.'
        }`,
      });
    }
  }

  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface IssueSummary {
  errors: number;
  warnings: number;
  infos: number;
}

export function summarizeIssues(issues: Issue[]): IssueSummary {
  return {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length,
  };
}

/** Zwaarste melding per apparaat (voor kleuring in 3D en 2D). */
export function worstSeverityByItem(issues: Issue[]): Map<string, Severity> {
  const rank: Record<Severity, number> = { error: 3, warning: 2, info: 1 };
  const map = new Map<string, Severity>();
  for (const issue of issues) {
    for (const id of issue.itemIds) {
      const current = map.get(id);
      if (!current || rank[issue.severity] > rank[current]) map.set(id, issue.severity);
    }
  }
  return map;
}
