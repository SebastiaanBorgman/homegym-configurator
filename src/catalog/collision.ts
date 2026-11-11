import type { RackAnchors } from '../domain/layout/autoLayout';
import type { Dimensions, LocalBox } from '../domain/types';
import type { Product } from './types';

/**
 * Massieve delen van open toestellen, in lokale coördinaten.
 *
 * Een power rack is geen dicht blok: tussen de staanders is ruimte voor een bank. Daarom
 * bestaat de botsingsvorm van zulke toestellen uit losse balken in plaats van één omhullend
 * blok. De 3D-modellen gebruiken dezelfde maatvoering, zodat beeld en berekening overeenkomen.
 */

const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): LocalBox => ({ x0, x1, z0, z1, y0, y1 });

/** Hoogte van de veiligheidsstangen in een rek (m). */
export const SAFETY_HEIGHT = 0.74;
/** Hoogte waarop de J-cups in de modellen zitten (m). */
export const JCUP_HEIGHT = 1.25;

/** Vierpoots power rack: vier staanders, zij- en achterbalk onder, raamwerk boven, open voorzijde. */
export function openRackParts(d: Dimensions, tube: number): LocalBox[] {
  const w2 = d.width / 2;
  const d2 = d.depth / 2;
  const h = d.height;
  const t = tube;
  return [
    box(-w2, -w2 + t, -d2, -d2 + t, 0, h),
    box(w2 - t, w2, -d2, -d2 + t, 0, h),
    box(-w2, -w2 + t, d2 - t, d2, 0, h),
    box(w2 - t, w2, d2 - t, d2, 0, h),
    // voetbalken links/rechts en achter
    box(-w2, -w2 + t, -d2, d2, 0, t),
    box(w2 - t, w2, -d2, d2, 0, t),
    box(-w2, w2, -d2, -d2 + t, 0, t),
    // raamwerk boven: vier balken, zodat het rek van bovenaf open blijft
    box(-w2, -w2 + t, -d2, d2, h - t, h),
    box(w2 - t, w2, -d2, d2, h - t, h),
    box(-w2, w2, -d2, -d2 + t, h - t, h),
    box(-w2, w2, d2 - t, d2, h - t, h),
    // veiligheidsstangen links/rechts
    box(-w2, -w2 + t, -d2, d2, SAFETY_HEIGHT - 0.04, SAFETY_HEIGHT + 0.04),
    box(w2 - t, w2, -d2, d2, SAFETY_HEIGHT - 0.04, SAFETY_HEIGHT + 0.04),
  ];
}

export interface HalfRackLayout {
  /** Halve breedte van het frame (zonder schijfhouders). */
  frameHalfWidth: number;
  /** z van het hart van de hoofdstaanders. */
  uprightZ: number;
  /** Lengte van de spotter arms. */
  armLength: number;
  armHeight: number;
}

export function halfRackLayout(d: Dimensions, tube: number): HalfRackLayout {
  return {
    frameHalfWidth: d.width / 2 - 0.12,
    uprightZ: -d.depth / 2 + 0.5 - tube / 2,
    armLength: 0.6,
    armHeight: 0.85,
  };
}

/** Half rack: massief achterdeel met opslag, daarvoor alleen voetbalken en spotter arms. */
export function halfRackParts(d: Dimensions, tube: number): LocalBox[] {
  const L = halfRackLayout(d, tube);
  const w2 = d.width / 2;
  const d2 = d.depth / 2;
  const fx = L.frameHalfWidth;
  const frontOfBlock = L.uprightZ + tube / 2;
  return [
    box(-w2, w2, -d2, frontOfBlock, 0, d.height),
    box(-fx, -fx + tube, frontOfBlock, d2, 0, tube),
    box(fx - tube, fx, frontOfBlock, d2, 0, tube),
    box(-fx, -fx + tube, frontOfBlock, frontOfBlock + L.armLength, L.armHeight - 0.07, L.armHeight + 0.07),
    box(fx - tube, fx, frontOfBlock, frontOfBlock + L.armLength, L.armHeight - 0.07, L.armHeight + 0.07),
  ];
}

/** Halve binnenbreedte van een alles-in-één station (m). */
export const ALL_IN_ONE_INNER_HALF = 0.515;

/** Alles-in-één station: twee massieve zijkolommen, bovenbalk en lage achterbalk; midden open. */
export function allInOneParts(d: Dimensions): LocalBox[] {
  const w2 = d.width / 2;
  const d2 = d.depth / 2;
  const inner = Math.min(ALL_IN_ONE_INNER_HALF, w2 - 0.2);
  return [
    box(-w2, -inner, -d2, d2, 0, d.height),
    box(inner, w2, -d2, d2, 0, d.height),
    box(-inner, inner, -d2, -d2 + 0.08, d.height - 0.08, d.height),
    box(-inner, inner, d2 - 0.08, d2, d.height - 0.08, d.height),
    box(-inner, inner, -d2, -d2 + 0.08, 0, 0.08),
  ];
}

export function collisionPartsFor(product: Product): LocalBox[] | undefined {
  const tube = product.tube ?? 0.075;
  switch (product.collision) {
    case 'openRack':
      return openRackParts(product.dimensions, tube);
    case 'halfRack':
      return halfRackParts(product.dimensions, tube);
    case 'allInOne':
      return allInOneParts(product.dimensions);
    default:
      return undefined;
  }
}

/** Waar bij een rek de stang (op de J-cups) en een bank horen; gebruikt door de indelingsgenerator. */
export function rackAnchorsFor(product: Product): RackAnchors | undefined {
  const tube = product.tube ?? 0.075;
  const d = product.dimensions;
  if (product.collision === 'openRack') {
    return { barZ: d.depth / 2 - tube - 0.045, barY: JCUP_HEIGHT, benchBackZ: -d.depth / 2 + tube + 0.06 };
  }
  if (product.collision === 'halfRack') {
    const front = halfRackLayout(d, tube).uprightZ + tube / 2;
    return { barZ: front + 0.045, barY: JCUP_HEIGHT, benchBackZ: front + 0.1 };
  }
  return undefined;
}
