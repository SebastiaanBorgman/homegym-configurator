import type { Design } from '../types';
import { importDesign, type ImportOptions, type ImportResult } from './serialize';

const DESIGN_KEY = 'homegym-studio:ontwerp:v1';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // bijv. geblokkeerd in privémodus
  }
}

/** Laadt het automatisch opgeslagen ontwerp; null als er niets (bruikbaars) staat. */
export function loadStoredDesign(options?: ImportOptions): ImportResult | null {
  const raw = storage()?.getItem(DESIGN_KEY);
  if (!raw) return null;
  try {
    return importDesign(JSON.parse(raw), options);
  } catch {
    return null;
  }
}

/** Slaat het ontwerp lokaal op. Geeft false terug als opslaan niet lukt (vol of geblokkeerd). */
export function storeDesign(design: Design): boolean {
  try {
    storage()?.setItem(DESIGN_KEY, JSON.stringify(design));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredDesign(): void {
  try {
    storage()?.removeItem(DESIGN_KEY);
  } catch {
    /* niets te doen */
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    /* niets te doen */
  }
}
