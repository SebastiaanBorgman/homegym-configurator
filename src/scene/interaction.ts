import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Dimensions } from '../domain/types';
import { snapForDrag } from '../state/derived';
import { useDesignStore } from '../state/designStore';
import { useUiStore } from '../state/uiStore';

/** Het deel van OrbitControls dat we nodig hebben. */
export interface ControlsLike {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
}

interface DragState {
  pointerId: number;
  plane: THREE.Plane;
  offsetX: number;
  offsetZ: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export interface FloorDragOptions {
  id: string;
  /** Actuele positie en vorm van het object op het moment van slepen. */
  getPose: () => { x: number; z: number; rotationDeg: number; dimensions: Dimensions } | null;
  onSelect: () => void;
  onMove: (x: number, z: number) => void;
}

const UP = new THREE.Vector3(0, 1, 0);
const hit = new THREE.Vector3();
const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** Aantal pixels dat de aanwijzer moet bewegen voordat een klik een sleepbeweging wordt. */
const DRAG_THRESHOLD_PX = 4;

function setCursor(cursor: string) {
  document.body.style.cursor = cursor;
}

/**
 * Slepen over de vloer met muis, pen of vinger.
 *
 * Bij het indrukken wordt de camerabesturing direct uitgeschakeld en de aanwijzer "gevangen",
 * zodat een sleepbeweging op een apparaat nooit per ongeluk de camera draait. Het vastgepakte
 * punt blijft onder de aanwijzer: we snijden de kijkstraal met een horizontaal vlak op de
 * hoogte waar het object werd beetgepakt.
 */
export function useFloorDrag(options: FloorDragOptions) {
  const get = useThree((s) => s.get);
  const state = useRef<DragState | null>(null);
  const latest = useRef(options);
  latest.current = options;

  const handlers = useMemo(() => {
    const finish = () => {
      if (!state.current) return;
      state.current = null;
      const controls = get().controls as unknown as ControlsLike | null;
      if (controls) controls.enabled = true;
      useUiStore.getState().setDragging(false);
      useUiStore.getState().setSnapGuides([]);
      setCursor('');
    };

    return {
      finish,
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const o = latest.current;
        o.onSelect();
        const pose = o.getPose();
        if (!pose) return;
        const controls = get().controls as unknown as ControlsLike | null;
        if (controls) controls.enabled = false;
        (e.target as Element).setPointerCapture(e.pointerId);
        state.current = {
          pointerId: e.pointerId,
          plane: new THREE.Plane(UP, -e.point.y),
          offsetX: pose.x - e.point.x,
          offsetZ: pose.z - e.point.z,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
        useUiStore.getState().setDragging(true);
        setCursor('grabbing');
      },
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        const s = state.current;
        if (!s || s.pointerId !== e.pointerId) return;
        e.stopPropagation();
        if (!s.moved) {
          if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < DRAG_THRESHOLD_PX) return;
          s.moved = true;
          useDesignStore.getState().beginGesture();
        }
        if (!e.ray.intersectPlane(s.plane, hit)) return;
        const o = latest.current;
        const pose = o.getPose();
        if (!pose) return;
        const snapped = snapForDrag(o.id, pose.dimensions, pose.rotationDeg, { x: hit.x + s.offsetX, z: hit.z + s.offsetZ }, e.altKey);
        o.onMove(round3(snapped.x), round3(snapped.z));
      },
      onPointerUp: (e: ThreeEvent<PointerEvent>) => {
        if (state.current?.pointerId !== e.pointerId) return;
        e.stopPropagation();
        (e.target as Element).releasePointerCapture(e.pointerId);
        finish();
      },
      onPointerCancel: (e: ThreeEvent<PointerEvent>) => {
        if (state.current?.pointerId !== e.pointerId) return;
        finish();
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (!state.current && !useUiStore.getState().dragging) setCursor('grab');
      },
      onPointerOut: () => {
        if (!state.current && !useUiStore.getState().dragging) setCursor('');
      },
    };
  }, [get]);

  // Wordt het object verwijderd tijdens het slepen, dan moet de camera weer vrijkomen.
  useEffect(() => () => handlers.finish(), [handlers]);

  return handlers;
}

export interface RotateDragOptions {
  getCentre: () => { x: number; z: number; y: number } | null;
  onRotate: (rotationDeg: number) => void;
}

/** Slepen aan de draaigreep: de voorzijde van het apparaat wijst naar de aanwijzer. */
export function useRotateDrag(options: RotateDragOptions) {
  const get = useThree((s) => s.get);
  const state = useRef<{ pointerId: number; plane: THREE.Plane; started: boolean } | null>(null);
  const latest = useRef(options);
  latest.current = options;

  const handlers = useMemo(() => {
    const finish = () => {
      if (!state.current) return;
      state.current = null;
      const controls = get().controls as unknown as ControlsLike | null;
      if (controls) controls.enabled = true;
      useUiStore.getState().setDragging(false);
      setCursor('');
    };
    return {
      finish,
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const centre = latest.current.getCentre();
        if (!centre) return;
        const controls = get().controls as unknown as ControlsLike | null;
        if (controls) controls.enabled = false;
        (e.target as Element).setPointerCapture(e.pointerId);
        state.current = { pointerId: e.pointerId, plane: new THREE.Plane(UP, -e.point.y), started: false };
        useUiStore.getState().setDragging(true);
        setCursor('grabbing');
      },
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        const s = state.current;
        if (!s || s.pointerId !== e.pointerId) return;
        e.stopPropagation();
        const centre = latest.current.getCentre();
        if (!centre || !e.ray.intersectPlane(s.plane, hit)) return;
        const dx = hit.x - centre.x;
        const dz = hit.z - centre.z;
        if (Math.hypot(dx, dz) < 0.05) return;
        if (!s.started) {
          s.started = true;
          useDesignStore.getState().beginGesture();
        }
        // De voorzijde (lokale +z) wijst in de ruimte naar (sin θ, cos θ).
        let deg = (Math.atan2(dx, dz) * 180) / Math.PI;
        if (!e.shiftKey) deg = Math.round(deg / 15) * 15; // Shift = vrij draaien
        latest.current.onRotate(deg);
      },
      onPointerUp: (e: ThreeEvent<PointerEvent>) => {
        if (state.current?.pointerId !== e.pointerId) return;
        e.stopPropagation();
        (e.target as Element).releasePointerCapture(e.pointerId);
        finish();
      },
      onPointerCancel: () => finish(),
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (!state.current) setCursor('grab');
      },
      onPointerOut: () => {
        if (!state.current) setCursor('');
      },
    };
  }, [get]);

  useEffect(() => () => handlers.finish(), [handlers]);
  return handlers;
}
