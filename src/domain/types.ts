/**
 * Kern-datamodel van een homegym-ontwerp.
 *
 * EENHEDEN EN ASSEN (één bron van waarheid voor 3D, 2D en berekeningen)
 * - Alle lengtes in METERS, rotaties in GRADEN.
 * - Oorsprong (0, 0, 0) ligt op de vloer in de hoek achterwand/linkerwand.
 * - x loopt langs de BREEDTE van de ruimte (0 … room.width), van links naar rechts.
 * - z loopt langs de LENGTE van de ruimte (0 … room.length), van achterwand naar voorwand.
 * - y is de HOOGTE (0 = vloer, room.height = plafond).
 *
 * APPARAAT-ASSEN (lokaal, bij rotatie 0)
 * - dimensions.width  = maat langs x (breedte)
 * - dimensions.depth  = maat langs z (diepte)
 * - dimensions.height = maat langs y (hoogte)
 * - lokale +z is de gebruikers-/voorzijde, lokale −z de achterzijde (wandzijde).
 * - Positie (x, z) is het MIDDEN van de voetafdruk; y is de hoogte van de onderkant.
 * - rotationDeg draait om de verticale as; positief = tegen de klok in, van bovenaf gezien
 *   (gelijk aan rotation.y in three.js).
 */

export interface Dimensions {
  width: number;
  depth: number;
  height: number;
}

export type WallId = 'north' | 'east' | 'south' | 'west';

export type FloorFinish = 'rubber' | 'hout' | 'beton' | 'vinyl';

export interface Room {
  width: number;
  length: number;
  height: number;
  floor: FloorFinish;
  wallColor: string;
}

export interface Opening {
  id: string;
  kind: 'door' | 'window';
  wall: WallId;
  /** Afstand in m vanaf het begin van de muur (x = 0 of z = 0) tot de start van de opening. */
  offset: number;
  width: number;
  height: number;
  /** Hoogte van de onderkant boven de vloer (0 voor deuren). */
  sill: number;
  /** Draairichting van een deur; bepaalt de vrij te houden zone. */
  swing: 'in' | 'out';
}

export interface Obstacle {
  id: string;
  name: string;
  /** Midden van de voetafdruk. */
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotationDeg: number;
}

export interface PlacedItem {
  id: string;
  productId: string;
  /** Momentopname van de productnaam, zodat een ontwerp leesbaar blijft als de catalogus wijzigt. */
  label: string;
  /** Momentopname van de fysieke buitenmaten waarmee is ontworpen. */
  dimensions: Dimensions;
  x: number;
  z: number;
  /** Hoogte van de onderkant boven de vloer (bijv. een halterstang op J-cups). */
  y: number;
  rotationDeg: number;
}

export interface Design {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  room: Room;
  openings: Opening[];
  obstacles: Obstacle[];
  items: PlacedItem[];
}

/** Hoe "vast" een apparaat staat; bepaalt de ernst van overlappingen. */
export type Mobility =
  /** Vast toestel: rack, machine, cardio. */
  | 'fixed'
  /** Verplaatsbaar tijdens training (bank, plyobox): mag in gebruiksruimte staan. */
  | 'movable'
  /** Los accessoire (stang, schijven, dumbbells): overlap is alleen een aandachtspunt. */
  | 'portable';

/** Rechthoekig volume in lokale apparaat-coördinaten (meters, t.o.v. midden voetafdruk). */
export interface LocalBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

export interface Clearance {
  front: number;
  back: number;
  left: number;
  right: number;
  /** 'manufacturer' = door fabrikant opgegeven, 'indicative' = eigen indicatie. */
  source: 'manufacturer' | 'indicative';
  note: string;
  sourceUrl?: string;
}

/** Fysieke eigenschappen die de ruimtecontrole nodig heeft; losgekoppeld van de catalogus. */
export interface PhysicalSpec {
  name: string;
  mobility: Mobility;
  /** Massieve delen; ontbreekt dit, dan geldt het volledige omhullende blok. */
  collisionParts?: LocalBox[];
  clearance?: Clearance;
  /** Toestel wordt boven het hoofd gebruikt (bijv. optrekstang). */
  overheadUse?: boolean;
}

export type SpecLookup = (item: PlacedItem) => PhysicalSpec;

export const WALL_LABELS: Record<WallId, string> = {
  north: 'Achterwand',
  east: 'Rechterwand',
  south: 'Voorwand',
  west: 'Linkerwand',
};

export const FLOOR_LABELS: Record<FloorFinish, string> = {
  rubber: 'Rubber sportvloer',
  hout: 'Houten vloer',
  beton: 'Beton',
  vinyl: 'Licht vinyl',
};

export const ROOM_LIMITS = {
  width: { min: 1.5, max: 15 },
  length: { min: 1.5, max: 20 },
  height: { min: 1.8, max: 6 },
} as const;
