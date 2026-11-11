import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { specOf } from '../catalog';
import { rotatedHalfExtents, wallFrame } from '../domain/geometry/shapes';
import { hasClearance, type Severity } from '../domain/geometry/validation';
import type { Dimensions, FloorFinish, Opening, Room } from '../domain/types';
import { cm, meters } from '../lib/format';
import { snapForDrag, useDerived } from '../state/derived';
import { useDesignStore } from '../state/designStore';
import { useUiStore } from '../state/uiStore';

/**
 * 2D-bovenaanzicht (plattegrond). Leest exact dezelfde gegevens als de 3D-weergave en gebruikt
 * dezelfde acties en hetzelfde magnetisch uitlijnen: wat je hier versleept, staat in 3D op
 * precies dezelfde plek. Getekend als SVG met meters als eenheid.
 */

const MARGIN = 0.95;
const WALL = 0.1;
const FLOOR_FILL: Record<FloorFinish, string> = { rubber: '#34373b', hout: '#c9a376', beton: '#b3b5b6', vinyl: '#dcd6ca' };
const STROKE: Record<Severity | 'none' | 'selected', string> = {
  none: '#14181b',
  selected: '#2f7cf6',
  error: '#e5484d',
  warning: '#f5a524',
  info: '#14181b',
};

interface Drag {
  kind: 'item' | 'obstacle';
  id: string;
  pointerId: number;
  offsetX: number;
  offsetZ: number;
  startX: number;
  startY: number;
  moved: boolean;
}

function OpeningShape({ room, o }: { room: Room; o: Opening }) {
  const f = wallFrame(room, o.wall);
  const outward = { x: -f.inward.x, z: -f.inward.z };
  const p = (along: number, out: number) => ({
    x: f.start.x + f.along.x * along + outward.x * out,
    z: f.start.z + f.along.z * along + outward.z * out,
  });
  const a = p(o.offset, 0);
  const b = p(o.offset + o.width, 0);
  const c = p(o.offset + o.width, WALL);
  const d = p(o.offset, WALL);
  const gap = `${a.x},${a.z} ${b.x},${b.z} ${c.x},${c.z} ${d.x},${d.z}`;
  if (o.kind === 'window') {
    const m1 = p(o.offset, WALL / 2);
    const m2 = p(o.offset + o.width, WALL / 2);
    return (
      <g>
        <polygon points={gap} fill="#cfe6f4" stroke="#6f7a84" strokeWidth={0.012} />
        <line x1={m1.x} y1={m1.z} x2={m2.x} y2={m2.z} stroke="#6f7a84" strokeWidth={0.012} />
      </g>
    );
  }
  const hinge = a;
  const open = { x: hinge.x + f.inward.x * o.width, z: hinge.z + f.inward.z * o.width };
  const cross = f.along.x * f.inward.z - f.along.z * f.inward.x;
  return (
    <g>
      <polygon points={gap} fill="#ffffff" stroke="#6f7a84" strokeWidth={0.012} />
      {o.swing === 'in' && (
        <path
          d={`M ${hinge.x} ${hinge.z} L ${open.x} ${open.z} M ${b.x} ${b.z} A ${o.width} ${o.width} 0 0 ${cross > 0 ? 1 : 0} ${open.x} ${open.z}`}
          fill="none"
          stroke="#8f98a1"
          strokeWidth={0.014}
          strokeDasharray="0.05 0.04"
        />
      )}
    </g>
  );
}

export function PlanView() {
  const design = useDesignStore((s) => s.design);
  const selection = useDesignStore((s) => s.selection);
  const showAllZones = useUiStore((s) => s.showAllZones);
  const showLabels = useUiStore((s) => s.showLabels);
  const guides = useUiStore((s) => s.snapGuides);
  const { severityByItem, issues } = useDerived();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const { room } = design;

  const blocked = useMemo(() => new Set(issues.filter((i) => i.code === 'CLEARANCE').map((i) => i.itemIds[0])), [issues]);
  // Grote apparaten onderop, kleine bovenop: zo blijft een bank in een rek aanklikbaar.
  const ordered = useMemo(
    () => [...design.items].sort((a, b) => b.dimensions.width * b.dimensions.depth - a.dimensions.width * a.dimensions.depth),
    [design.items],
  );

  const toPlan = (clientX: number, clientY: number) => {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return null;
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, z: p.y };
  };

  const begin = (e: ReactPointerEvent, kind: Drag['kind'], id: string, x: number, z: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useDesignStore.getState().select({ kind, id });
    const p = toPlan(e.clientX, e.clientY);
    if (!p) return;
    svg.current?.setPointerCapture(e.pointerId);
    drag.current = { kind, id, pointerId: e.pointerId, offsetX: x - p.x, offsetZ: z - p.z, startX: e.clientX, startY: e.clientY, moved: false };
  };

  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
      d.moved = true;
      useDesignStore.getState().beginGesture();
      useUiStore.getState().setDragging(true);
    }
    const p = toPlan(e.clientX, e.clientY);
    if (!p) return;
    const state = useDesignStore.getState();
    let dims: Dimensions | null = null;
    let rotationDeg = 0;
    if (d.kind === 'item') {
      const item = state.design.items.find((i) => i.id === d.id);
      if (item) {
        dims = item.dimensions;
        rotationDeg = item.rotationDeg;
      }
    } else {
      const o = state.design.obstacles.find((x) => x.id === d.id);
      if (o) {
        dims = { width: o.width, depth: o.depth, height: o.height };
        rotationDeg = o.rotationDeg;
      }
    }
    if (!dims) return;
    const snapped = snapForDrag(d.id, dims, rotationDeg, { x: p.x + d.offsetX, z: p.z + d.offsetZ }, e.altKey);
    const x = Math.round(snapped.x * 1000) / 1000;
    const z = Math.round(snapped.z * 1000) / 1000;
    if (d.kind === 'item') state.updateItem(d.id, { x, z }, false);
    else state.updateObstacle(d.id, { x, z }, false);
  };

  const end = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    svg.current?.releasePointerCapture(e.pointerId);
    useUiStore.getState().setDragging(false);
    useUiStore.getState().setSnapGuides([]);
  };

  const W = room.width;
  const L = room.length;
  const font = Math.max(0.085, Math.min(0.13, Math.max(W, L) / 55));

  return (
    <svg
      ref={svg}
      id="plattegrond"
      data-testid="plan-view"
      viewBox={`${-MARGIN} ${-MARGIN} ${W + 2 * MARGIN} ${L + 2 * MARGIN}`}
      preserveAspectRatio="xMidYMid meet"
      className="size-full touch-none select-none"
      fontFamily="Inter, system-ui, sans-serif"
      onPointerDown={() => useDesignStore.getState().select(null)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      role="img"
      aria-label="Plattegrond van de homegym"
    >
      <defs>
        <pattern id="arcering" width={0.08} height={0.08} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={0.08} height={0.08} fill="#b9bbbd" />
          <line x1={0} y1={0} x2={0} y2={0.08} stroke="#7d8388" strokeWidth={0.03} />
        </pattern>
        <pattern id="raster" width={0.5} height={0.5} patternUnits="userSpaceOnUse">
          <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke={room.floor === 'rubber' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'} strokeWidth={0.01} />
        </pattern>
      </defs>

      {/* vloer en muren */}
      <rect x={0} y={0} width={W} height={L} fill={FLOOR_FILL[room.floor]} />
      <rect x={0} y={0} width={W} height={L} fill="url(#raster)" />
      <path
        fillRule="evenodd"
        fill="#2b2f33"
        d={`M ${-WALL} ${-WALL} H ${W + WALL} V ${L + WALL} H ${-WALL} Z M 0 0 V ${L} H ${W} V 0 Z`}
      />
      {design.openings.map((o) => (
        <OpeningShape key={o.id} room={room} o={o} />
      ))}

      {/* maatlijnen */}
      <g stroke="#5f656c" strokeWidth={0.012} fill="#3b4148" fontSize={0.15} fontWeight={600} textAnchor="middle">
        <line x1={0} y1={L + 0.42} x2={W} y2={L + 0.42} />
        <line x1={0} y1={L + 0.34} x2={0} y2={L + 0.5} />
        <line x1={W} y1={L + 0.34} x2={W} y2={L + 0.5} />
        <text x={W / 2} y={L + 0.68} stroke="none" data-testid="plan-width">
          {meters(W)}
        </text>
        <line x1={W + 0.42} y1={0} x2={W + 0.42} y2={L} />
        <line x1={W + 0.34} y1={0} x2={W + 0.5} y2={0} />
        <line x1={W + 0.34} y1={L} x2={W + 0.5} y2={L} />
        <text x={W + 0.6} y={L / 2} stroke="none" transform={`rotate(90 ${W + 0.6} ${L / 2})`} data-testid="plan-length">
          {meters(L)}
        </text>
      </g>

      {/* obstakels */}
      {design.obstacles.map((o) => {
        const selected = selection?.id === o.id;
        return (
          <g key={o.id} transform={`translate(${o.x} ${o.z}) rotate(${-o.rotationDeg})`} onPointerDown={(e) => begin(e, 'obstacle', o.id, o.x, o.z)} style={{ cursor: 'grab' }}>
            <rect
              x={-o.width / 2}
              y={-o.depth / 2}
              width={o.width}
              height={o.depth}
              fill="url(#arcering)"
              stroke={selected ? STROKE.selected : '#4b535b'}
              strokeWidth={selected ? 0.03 : 0.015}
            />
          </g>
        );
      })}

      {/* gebruiksruimtes */}
      {ordered.map((item) => {
        const spec = specOf(item);
        const c = spec.clearance;
        if (!c || !hasClearance(spec) || !(showAllZones || selection?.id === item.id)) return null;
        const { width: w, depth: d } = item.dimensions;
        const color = blocked.has(item.id) ? '#f5a524' : c.source === 'manufacturer' ? '#2f7cf6' : '#8b929c';
        return (
          <g key={`zone-${item.id}`} transform={`translate(${item.x} ${item.z}) rotate(${-item.rotationDeg})`} pointerEvents="none">
            <rect
              x={-w / 2 - c.left}
              y={-d / 2 - c.back}
              width={w + c.left + c.right}
              height={d + c.back + c.front}
              fill={color}
              fillOpacity={0.14}
              stroke={color}
              strokeWidth={0.015}
              strokeDasharray="0.08 0.05"
            />
          </g>
        );
      })}

      {/* apparaten */}
      {ordered.map((item) => {
        const { width: w, depth: d } = item.dimensions;
        const selected = selection?.id === item.id;
        const severity = severityByItem.get(item.id);
        const stroke = severity === 'error' ? STROKE.error : selected ? STROKE.selected : severity === 'warning' ? STROKE.warning : STROKE.none;
        const { hx, hz } = rotatedHalfExtents(item.dimensions, item.rotationDeg);
        const maxChars = Math.max(0, Math.floor((hx * 2 - 0.08) / (font * 0.62)));
        const fits = hz * 2 >= font * 1.5; // te smalle objecten (bijv. een halterstang) krijgen geen tekst
        const label = !fits ? '' : item.label.length > maxChars ? (maxChars > 4 ? `${item.label.slice(0, maxChars - 1)}…` : '') : item.label;
        const tri = Math.min(0.09, w / 4, d / 4);
        return (
          <g key={item.id} data-testid={`plan-item-${item.productId}`} data-item-id={item.id} onPointerDown={(e) => begin(e, 'item', item.id, item.x, item.z)} style={{ cursor: 'grab' }}>
            <g transform={`translate(${item.x} ${item.z}) rotate(${-item.rotationDeg})`}>
              <rect
                x={-w / 2}
                y={-d / 2}
                width={w}
                height={d}
                rx={Math.min(0.03, w / 4, d / 4)}
                fill={severity === 'error' ? '#fbdcdd' : selected ? '#e8f1fe' : '#ffffff'}
                fillOpacity={0.94}
                stroke={stroke}
                strokeWidth={selected || severity === 'error' ? 0.035 : 0.018}
              />
              {/* voorzijde */}
              <polygon points={`${-tri},${d / 2 - tri * 1.5} ${tri},${d / 2 - tri * 1.5} 0,${d / 2 - tri * 0.3}`} fill={stroke} opacity={0.75} />
            </g>
            {showLabels && label && (
              <text x={item.x} y={item.z} textAnchor="middle" dominantBaseline="central" fontSize={font} fontWeight={600} fill="#14181b" pointerEvents="none">
                {label}
              </text>
            )}
            {showLabels && selected && (
              <text x={item.x} y={item.z + font * 1.35} textAnchor="middle" dominantBaseline="central" fontSize={font * 0.88} fill="#2f7cf6" fontWeight={600} pointerEvents="none">
                {cm(w)} × {cm(d)} cm
              </text>
            )}
          </g>
        );
      })}

      {/* hulplijnen van het magnetisch uitlijnen */}
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <line key={i} x1={g.value} y1={-0.3} x2={g.value} y2={L + 0.3} stroke="#7fa80c" strokeWidth={0.02} pointerEvents="none" />
        ) : (
          <line key={i} x1={-0.3} y1={g.value} x2={W + 0.3} y2={g.value} stroke="#7fa80c" strokeWidth={0.02} pointerEvents="none" />
        ),
      )}

      <text x={W / 2} y={-0.3} textAnchor="middle" fontSize={0.13} fontWeight={700} fill="#6c757e" letterSpacing={0.02}>
        ACHTERWAND
      </text>
    </svg>
  );
}
