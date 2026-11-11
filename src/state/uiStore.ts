import { create } from 'zustand';
import type { SnapGuide } from '../domain/geometry/snapping';
import { readJson, writeJson } from '../domain/storage/localStore';

export type ViewMode = '3d' | '2d';
export type WallMode = 'auto' | 'vol' | 'verborgen';
export type CameraPreset = 'standaard' | 'boven' | 'laag' | 'binnen' | 'zoom-in' | 'zoom-uit';
export type LeftTab = 'catalogus' | 'ruimte' | 'indeling';
export type RightTab = 'controle' | 'bestellijst';
export type PanelTab = LeftTab | RightTab;
export type MobileSheet = PanelTab | null;

/** Instellingen die tussen sessies bewaard blijven. */
interface Preferences {
  wallMode: WallMode;
  snapWalls: boolean;
  snapObjects: boolean;
  snapGrid: boolean;
  gridSize: number;
  showAllZones: boolean;
  showLabels: boolean;
}

const PREFS_KEY = 'homegym-studio:voorkeuren:v1';

const DEFAULT_PREFS: Preferences = {
  wallMode: 'auto',
  snapWalls: true,
  snapObjects: true,
  snapGrid: false,
  gridSize: 0.25,
  showAllZones: false,
  showLabels: true,
};

interface UiState extends Preferences {
  viewMode: ViewMode;
  /** Actief tabblad van het linkerpaneel; op smallere schermen bevat dat ook controle en bestellijst. */
  leftTab: PanelTab;
  rightTab: RightTab;
  mobileSheet: MobileSheet;
  /** Product waarvan het detailvenster open staat. */
  productDialogId: string | null;
  /** Opdracht aan de camera; `nonce` verandert bij elke nieuwe opdracht. */
  cameraCommand: { preset: CameraPreset; nonce: number };
  /** Hulplijnen van het magnetisch uitlijnen tijdens het slepen. */
  snapGuides: SnapGuide[];
  /** True zolang er een object wordt gesleept (camera staat dan stil). */
  dragging: boolean;

  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  setViewMode: (mode: ViewMode) => void;
  setLeftTab: (tab: PanelTab) => void;
  setRightTab: (tab: RightTab) => void;
  setMobileSheet: (sheet: MobileSheet) => void;
  openProduct: (id: string | null) => void;
  sendCamera: (preset: CameraPreset) => void;
  setSnapGuides: (guides: SnapGuide[]) => void;
  setDragging: (dragging: boolean) => void;
}

const stored = readJson<Preferences>(PREFS_KEY, DEFAULT_PREFS);

export const useUiStore = create<UiState>((set, get) => ({
  ...DEFAULT_PREFS,
  ...stored,
  viewMode: '3d',
  leftTab: 'catalogus',
  rightTab: 'controle',
  mobileSheet: null,
  productDialogId: null,
  cameraCommand: { preset: 'standaard', nonce: 0 },
  snapGuides: [],
  dragging: false,

  setPreference: (key, value) => {
    set({ [key]: value } as Pick<Preferences, typeof key>);
    const s = get();
    const prefs: Preferences = {
      wallMode: s.wallMode,
      snapWalls: s.snapWalls,
      snapObjects: s.snapObjects,
      snapGrid: s.snapGrid,
      gridSize: s.gridSize,
      showAllZones: s.showAllZones,
      showLabels: s.showLabels,
    };
    writeJson(PREFS_KEY, prefs);
  },
  setViewMode: (viewMode) => set({ viewMode }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setRightTab: (rightTab) => set({ rightTab }),
  setMobileSheet: (mobileSheet) => set({ mobileSheet }),
  openProduct: (productDialogId) => set({ productDialogId }),
  sendCamera: (preset) => set((s) => ({ cameraCommand: { preset, nonce: s.cameraCommand.nonce + 1 } })),
  setSnapGuides: (snapGuides) => {
    if (snapGuides.length === 0 && get().snapGuides.length === 0) return;
    set({ snapGuides });
  },
  setDragging: (dragging) => set({ dragging }),
}));

// ───────────────────────────────── Meldingen (toasts) ─────────────────────────────────

export interface Toast {
  id: number;
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  detail?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast, durationMs = 4200) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-1), { ...toast, id }] });
    setTimeout(() => get().dismiss(id), durationMs);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (tone: Toast['tone'], title: string, detail?: string) =>
  useToastStore.getState().push({ tone, title, detail }, tone === 'error' || tone === 'warning' ? 7000 : 4200);
