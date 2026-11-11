import { create } from 'zustand';
import { getProduct, productLabel, resolveProduct, specOf } from '../catalog';
import { ROOM_PRESETS, createDefaultDesign, designFromPreset } from '../domain/defaults';
import { findFreeSpot, nearestWall, placeAgainstWall, rotateBy } from '../domain/geometry/placement';
import { clampOpening, fullLocalBox, orientedBoxFromLocal, outsideRoomDistance, penetration3D, wallLength } from '../domain/geometry/shapes';
import { itemParts } from '../domain/geometry/validation';
import { newId } from '../domain/id';
import { loadStoredDesign, storeDesign } from '../domain/storage/localStore';
import type { Design, Obstacle, Opening, PlacedItem, Room, WallId } from '../domain/types';
import { ROOM_LIMITS } from '../domain/types';

/**
 * Centrale bron van waarheid voor het ontwerp. De 3D-weergave, het 2D-bovenaanzicht,
 * de ruimtecontrole en de bestellijst lezen allemaal uit deze ene store.
 */

export type Selection = { kind: 'item' | 'obstacle' | 'opening'; id: string };

const HISTORY_LIMIT = 80;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const round3 = (v: number) => Math.round(v * 1000) / 1000;

interface DesignState {
  design: Design;
  selection: Selection | null;
  past: Design[];
  future: Design[];
  /** True als automatisch opslaan niet lukt (opslag vol of geblokkeerd). */
  saveFailed: boolean;
  /** Meldingen van het laden bij de start (bijv. bijgewerkte afmetingen). */
  loadWarnings: string[];

  select: (selection: Selection | null) => void;
  /** Start van een sleepbeweging: één stap in de geschiedenis voor de hele beweging. */
  beginGesture: () => void;

  setRoom: (patch: Partial<Room>) => void;
  applyPreset: (presetId: string) => void;
  renameDesign: (name: string) => void;

  addProduct: (productId: string) => string | null;
  updateItem: (id: string, patch: Partial<Pick<PlacedItem, 'x' | 'z' | 'y' | 'rotationDeg'>>, history?: boolean) => void;
  rotateItem: (id: string, deltaDeg: number) => void;
  duplicateItem: (id: string) => string | null;
  removeItem: (id: string) => void;
  removeOneOfProduct: (productId: string) => void;
  removeAllOfProduct: (productId: string) => void;
  moveItemToWall: (id: string, wall?: WallId) => void;
  clearItems: () => void;
  applyGeneratedLayout: (items: PlacedItem[]) => void;

  addOpening: (kind: Opening['kind']) => string;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;

  addObstacle: () => string;
  updateObstacle: (id: string, patch: Partial<Obstacle>, history?: boolean) => void;
  removeObstacle: (id: string) => void;

  newDesign: () => void;
  loadDesign: (design: Design) => void;
  undo: () => void;
  redo: () => void;
}

function initialDesign(): { design: Design; warnings: string[] } {
  const stored = loadStoredDesign({ resolveProduct });
  if (stored) return { design: stored.design, warnings: stored.warnings };
  return { design: createDefaultDesign(), warnings: [] };
}

const initial = initialDesign();

export const useDesignStore = create<DesignState>((set, get) => {
  /** Past het ontwerp aan; legt de vorige toestand vast voor ongedaan maken. */
  const commit = (mutate: (d: Design) => Design, history = true) => {
    const { design, past } = get();
    const next = mutate(design);
    if (next === design) return;
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    set(
      history
        ? { design: stamped, past: [...past.slice(-(HISTORY_LIMIT - 1)), design], future: [] }
        : { design: stamped },
    );
  };

  const mapItem = (d: Design, id: string, fn: (i: PlacedItem) => PlacedItem): Design => {
    let changed = false;
    const items = d.items.map((i) => {
      if (i.id !== id) return i;
      const next = fn(i);
      if (next !== i) changed = true;
      return next;
    });
    return changed ? { ...d, items } : d;
  };

  return {
    design: initial.design,
    selection: null,
    past: [],
    future: [],
    saveFailed: false,
    loadWarnings: initial.warnings,

    select: (selection) => set({ selection }),

    beginGesture: () => {
      const { design, past } = get();
      set({ past: [...past.slice(-(HISTORY_LIMIT - 1)), design], future: [] });
    },

    setRoom: (patch) =>
      commit((d) => {
        const room: Room = { ...d.room, ...patch };
        room.width = clamp(room.width, ROOM_LIMITS.width.min, ROOM_LIMITS.width.max);
        room.length = clamp(room.length, ROOM_LIMITS.length.min, ROOM_LIMITS.length.max);
        room.height = clamp(room.height, ROOM_LIMITS.height.min, ROOM_LIMITS.height.max);
        return { ...d, room, openings: d.openings.map((o) => clampOpening(room, o)) };
      }),

    applyPreset: (presetId) =>
      commit((d) => {
        const preset = ROOM_PRESETS.find((p) => p.id === presetId);
        if (!preset) return d;
        const fresh = designFromPreset(preset, d.name);
        return { ...d, room: fresh.room, openings: fresh.openings, obstacles: fresh.obstacles };
      }),

    renameDesign: (name) => commit((d) => ({ ...d, name: name.slice(0, 80) }), false),

    addProduct: (productId) => {
      const product = getProduct(productId);
      if (!product) return null;
      const id = newId('item');
      commit((d) => {
        const spot = findFreeSpot(d, product.dimensions, specOf);
        const item: PlacedItem = {
          id,
          productId,
          label: productLabel(product),
          dimensions: { ...product.dimensions },
          x: round3(spot.x),
          z: round3(spot.z),
          y: 0,
          rotationDeg: 0,
        };
        return { ...d, items: [...d.items, item] };
      });
      set({ selection: { kind: 'item', id } });
      return id;
    },

    updateItem: (id, patch, history = true) =>
      commit((d) => {
        const maxY = Math.max(0, d.room.height);
        return mapItem(d, id, (i) => {
          const next = { ...i, ...patch };
          next.x = clamp(next.x, -3, d.room.width + 3);
          next.z = clamp(next.z, -3, d.room.length + 3);
          next.y = clamp(next.y, 0, maxY);
          next.rotationDeg = rotateBy(next.rotationDeg, 0);
          if (next.x === i.x && next.z === i.z && next.y === i.y && next.rotationDeg === i.rotationDeg) return i;
          return next;
        });
      }, history),

    rotateItem: (id, deltaDeg) =>
      commit((d) => mapItem(d, id, (i) => ({ ...i, rotationDeg: rotateBy(i.rotationDeg, deltaDeg) }))),

    duplicateItem: (id) => {
      const source = get().design.items.find((i) => i.id === id);
      if (!source) return null;
      const copyId = newId('item');
      commit((d) => {
        const spec = specOf(source);
        const occupied = [...d.items.flatMap((i) => itemParts(i, specOf(i)))];
        // Probeer eerst direct ernaast, daarna de dichtstbijzijnde vrije plek.
        const steps: [number, number][] = [
          [source.dimensions.width + 0.1, 0],
          [-(source.dimensions.width + 0.1), 0],
          [0, source.dimensions.depth + 0.1],
          [0, -(source.dimensions.depth + 0.1)],
        ];
        let spot: { x: number; z: number } | null = null;
        for (const [dx, dz] of steps) {
          const pose = { x: source.x + dx, z: source.z + dz, y: source.y, rotationDeg: source.rotationDeg };
          const box = orientedBoxFromLocal(fullLocalBox(source.dimensions), pose);
          if (outsideRoomDistance(box, d.room) > 0.001) continue;
          const candidate = itemParts({ ...source, ...pose }, spec);
          if (occupied.some((o) => candidate.some((c) => penetration3D(c, o) > 0.005))) continue;
          spot = { x: pose.x, z: pose.z };
          break;
        }
        if (!spot) spot = findFreeSpot(d, source.dimensions, specOf, source.rotationDeg);
        const copy: PlacedItem = { ...source, id: copyId, dimensions: { ...source.dimensions }, x: round3(spot.x), z: round3(spot.z) };
        return { ...d, items: [...d.items, copy] };
      });
      set({ selection: { kind: 'item', id: copyId } });
      return copyId;
    },

    removeItem: (id) => {
      commit((d) => (d.items.some((i) => i.id === id) ? { ...d, items: d.items.filter((i) => i.id !== id) } : d));
      if (get().selection?.id === id) set({ selection: null });
    },

    removeOneOfProduct: (productId) => {
      const last = [...get().design.items].reverse().find((i) => i.productId === productId);
      if (last) get().removeItem(last.id);
    },

    removeAllOfProduct: (productId) => {
      const selected = get().selection;
      const removing = get().design.items.filter((i) => i.productId === productId);
      commit((d) => (removing.length ? { ...d, items: d.items.filter((i) => i.productId !== productId) } : d));
      if (selected && removing.some((i) => i.id === selected.id)) set({ selection: null });
    },

    moveItemToWall: (id, wall) =>
      commit((d) =>
        mapItem(d, id, (i) => {
          const target = wall ?? nearestWall({ x: i.x, z: i.z }, d.room);
          const placed = placeAgainstWall(i, target, d.room);
          return { ...i, x: round3(placed.x), z: round3(placed.z), rotationDeg: placed.rotationDeg };
        }),
      ),

    clearItems: () => {
      commit((d) => (d.items.length ? { ...d, items: [] } : d));
      set({ selection: null });
    },

    applyGeneratedLayout: (items) => {
      commit((d) => ({ ...d, items: items.map((i) => ({ ...i, id: newId('item'), dimensions: { ...i.dimensions } })) }));
      set({ selection: null });
    },

    addOpening: (kind) => {
      const id = newId('opening');
      commit((d) => {
        // Kies de muur met de minste openingen en zet de nieuwe in het midden.
        const walls: WallId[] = ['north', 'east', 'south', 'west'];
        const wall = walls
          .map((w) => ({ w, n: d.openings.filter((o) => o.wall === w).length }))
          .sort((a, b) => a.n - b.n)[0].w;
        const width = kind === 'door' ? 0.9 : 1.2;
        const opening: Opening = clampOpening(d.room, {
          id,
          kind,
          wall,
          offset: (wallLength(d.room, wall) - width) / 2,
          width,
          height: kind === 'door' ? 2.1 : 1.1,
          sill: kind === 'door' ? 0 : 0.9,
          swing: 'in',
        });
        return { ...d, openings: [...d.openings, opening] };
      });
      set({ selection: { kind: 'opening', id } });
      return id;
    },

    updateOpening: (id, patch) =>
      commit((d) => ({
        ...d,
        openings: d.openings.map((o) => (o.id === id ? clampOpening(d.room, { ...o, ...patch, id: o.id, kind: o.kind }) : o)),
      })),

    removeOpening: (id) => {
      commit((d) => ({ ...d, openings: d.openings.filter((o) => o.id !== id) }));
      if (get().selection?.id === id) set({ selection: null });
    },

    addObstacle: () => {
      const id = newId('obstakel');
      commit((d) => {
        const dims = { width: 0.3, depth: 0.3, height: d.room.height };
        const spot = findFreeSpot(d, dims, specOf);
        const count = d.obstacles.length + 1;
        const obstacle: Obstacle = { id, name: `Pilaar ${count}`, x: round3(spot.x), z: round3(spot.z), ...dims, rotationDeg: 0 };
        return { ...d, obstacles: [...d.obstacles, obstacle] };
      });
      set({ selection: { kind: 'obstacle', id } });
      return id;
    },

    updateObstacle: (id, patch, history = true) =>
      commit(
        (d) => ({
          ...d,
          obstacles: d.obstacles.map((o) => {
            if (o.id !== id) return o;
            const next = { ...o, ...patch, id: o.id };
            next.width = clamp(next.width, 0.05, 10);
            next.depth = clamp(next.depth, 0.05, 10);
            next.height = clamp(next.height, 0.05, d.room.height);
            next.x = clamp(next.x, -1, d.room.width + 1);
            next.z = clamp(next.z, -1, d.room.length + 1);
            return next;
          }),
        }),
        history,
      ),

    removeObstacle: (id) => {
      commit((d) => ({ ...d, obstacles: d.obstacles.filter((o) => o.id !== id) }));
      if (get().selection?.id === id) set({ selection: null });
    },

    newDesign: () => {
      const { design, past } = get();
      set({ design: createDefaultDesign(), past: [...past.slice(-(HISTORY_LIMIT - 1)), design], future: [], selection: null });
    },

    loadDesign: (next) => {
      const { design, past } = get();
      set({ design: next, past: [...past.slice(-(HISTORY_LIMIT - 1)), design], future: [], selection: null });
    },

    undo: () => {
      const { past, future, design } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      set({ design: previous, past: past.slice(0, -1), future: [design, ...future].slice(0, HISTORY_LIMIT), selection: null });
    },

    redo: () => {
      const { past, future, design } = get();
      const next = future[0];
      if (!next) return;
      set({ design: next, past: [...past, design].slice(-HISTORY_LIMIT), future: future.slice(1), selection: null });
    },
  };
});

// ───────────── Automatisch lokaal opslaan (met korte vertraging tijdens slepen) ─────────────
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastSaved: Design | null = null;

function flushSave() {
  const { design, saveFailed } = useDesignStore.getState();
  if (design === lastSaved) return;
  const ok = storeDesign(design);
  lastSaved = design;
  if (ok === saveFailed) useDesignStore.setState({ saveFailed: !ok });
}

useDesignStore.subscribe((state, previous) => {
  if (state.design === previous.design) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 250);
});

if (typeof window !== 'undefined') {
  // Niets kwijtraken bij het sluiten of verversen van de pagina.
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('beforeunload', flushSave);
}
