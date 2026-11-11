import type { Dimensions } from '../domain/types';

const nl1 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const nl2 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Meters → centimeters met maximaal één decimaal, bijv. 1.2192 → "121,9". */
export function cm(meters: number): string {
  return nl1.format(Math.round(meters * 1000) / 10);
}

/** Meters met twee decimalen, bijv. 4 → "4,00 m". */
export function meters(value: number): string {
  return `${nl2.format(value)} m`;
}

/** Breedte × diepte × hoogte in centimeters. */
export function formatDims(d: Dimensions): string {
  return `${cm(d.width)} × ${cm(d.depth)} × ${cm(d.height)} cm`;
}

export function formatFootprint(d: Dimensions): string {
  return `${cm(d.width)} × ${cm(d.depth)} cm`;
}

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

/** "2026-11-10" → "10 november 2026". */
export function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d);
}

export function formatArea(m2: number): string {
  return `${nl1.format(m2)} m²`;
}

/** Leest een door de gebruiker getypt getal met komma of punt. */
export function parseNumber(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
