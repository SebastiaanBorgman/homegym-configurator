/**
 * Brug tussen de 3D-scène en de rest van de applicatie. De scène registreert hier een paar
 * functies (afbeelding maken, de werkelijk getekende maten opvragen); de interface en de
 * browsertests roepen ze aan zonder zelf iets van three.js te hoeven weten.
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface SceneInfo {
  /** Afmetingen van het getekende vloervlak. */
  floor: { width: number; length: number } | null;
  /** Hoogte van elke getekende muur. */
  wallHeights: Record<string, number>;
  /** Wereld-omhullende van elk getekend apparaat (as-parallel). */
  items: { id: string; size: Vec3Like; min: Vec3Like; max: Vec3Like }[];
}

export interface SceneApi {
  /** PNG van het huidige beeld als data-URL (transparante achtergrond). */
  capture: () => string | null;
  info: () => SceneInfo;
  /** Projecteert een punt in de ruimte naar schermcoördinaten (CSS-pixels). */
  project: (x: number, y: number, z: number) => { x: number; y: number } | null;
  camera: () => { position: Vec3Like; target: Vec3Like };
}

export const sceneApi: { current: SceneApi | null } = { current: null };
