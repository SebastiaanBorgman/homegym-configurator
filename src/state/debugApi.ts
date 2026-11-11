import { sceneApi } from '../scene/bridge';
import { derive } from './derived';
import { useDesignStore } from './designStore';
import { useUiStore } from './uiStore';

/**
 * Kleine inspectie-interface op `window.__homegym`. Hiermee controleren de browsertests de
 * WERKELIJKE toestand van de draaiende applicatie: het ontwerp in de store, de uitkomst van de
 * ruimtecontrole en de maten van wat er daadwerkelijk in 3D is getekend. Alleen-lezen, op de
 * camera-opdracht na.
 */
export function installDebugApi() {
  const api = {
    design: () => useDesignStore.getState().design,
    selection: () => useDesignStore.getState().selection,
    issues: () => derive(useDesignStore.getState().design).issues,
    order: () => derive(useDesignStore.getState().design).order,
    scene: () => sceneApi.current?.info() ?? null,
    project: (x: number, y: number, z: number) => sceneApi.current?.project(x, y, z) ?? null,
    camera: () => sceneApi.current?.camera() ?? null,
    /** PNG (data-URL) van het actuele 3D-beeld, om te controleren dat er echt iets getekend wordt. */
    capture: () => sceneApi.current?.capture() ?? null,
    sendCamera: (preset: Parameters<ReturnType<typeof useUiStore.getState>['sendCamera']>[0]) => useUiStore.getState().sendCamera(preset),
  };
  (window as unknown as { __homegym: typeof api }).__homegym = api;
  return api;
}

export type DebugApi = ReturnType<typeof installDebugApi>;
