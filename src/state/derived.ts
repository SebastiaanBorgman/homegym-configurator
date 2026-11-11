import { priceOf, specOf } from '../catalog';
import { snapPosition, type SnapOptions } from '../domain/geometry/snapping';
import { aabbOf, itemBox, obstacleBox, type Aabb } from '../domain/geometry/shapes';
import { summarizeIssues, validateDesign, worstSeverityByItem, type Issue, type IssueSummary, type Severity } from '../domain/geometry/validation';
import { buildOrder, type OrderSummary } from '../domain/pricing';
import type { Design, Dimensions } from '../domain/types';
import { useDesignStore } from './designStore';
import { useUiStore } from './uiStore';

/**
 * Afgeleide gegevens (ruimtecontrole en bestellijst). Ze worden één keer per ontwerp-toestand
 * berekend en gedeeld door alle onderdelen van de interface.
 */

interface Derived {
  issues: Issue[];
  summary: IssueSummary;
  severityByItem: Map<string, Severity>;
  order: OrderSummary;
}

let cachedFor: Design | null = null;
let cached: Derived | null = null;

export function derive(design: Design): Derived {
  if (cachedFor === design && cached) return cached;
  const issues = validateDesign(design, specOf);
  cached = {
    issues,
    summary: summarizeIssues(issues),
    severityByItem: worstSeverityByItem(issues),
    order: buildOrder(design.items, priceOf),
  };
  cachedFor = design;
  return cached;
}

export const useDerived = (): Derived => derive(useDesignStore((s) => s.design));

/** Vangafstand voor magnetisch uitlijnen (m). */
const SNAP_THRESHOLD = 0.12;

/** Past magnetisch uitlijnen toe volgens de huidige voorkeuren; gedeeld door 3D en 2D. */
export function snapForDrag(
  movingId: string,
  dims: Dimensions,
  rotationDeg: number,
  proposed: { x: number; z: number },
  bypass = false,
): { x: number; z: number } {
  const ui = useUiStore.getState();
  const { design } = useDesignStore.getState();
  if (bypass || (!ui.snapWalls && !ui.snapObjects && !ui.snapGrid)) {
    ui.setSnapGuides([]);
    return proposed;
  }
  const others: Aabb[] = [];
  if (ui.snapObjects) {
    for (const i of design.items) if (i.id !== movingId) others.push(aabbOf(itemBox(i)));
    for (const o of design.obstacles) if (o.id !== movingId) others.push(aabbOf(obstacleBox(o)));
  }
  const options: SnapOptions = {
    walls: ui.snapWalls,
    objects: ui.snapObjects,
    grid: ui.snapGrid,
    gridSize: ui.gridSize,
    threshold: SNAP_THRESHOLD,
  };
  const result = snapPosition(dims, rotationDeg, proposed, design.room, others, options);
  ui.setSnapGuides(result.guides.filter((g) => g.kind !== 'grid'));
  return { x: result.x, z: result.z };
}
