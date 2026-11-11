import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { getProduct, specOf } from '../catalog';
import { degToRad, fullLocalBox } from '../domain/geometry/shapes';
import { hasClearance, type Severity } from '../domain/geometry/validation';
import type { Obstacle, PhysicalSpec, PlacedItem } from '../domain/types';
import { createModelInstance } from '../models';
import { useDesignStore } from '../state/designStore';
import { useFloorDrag, useRotateDrag } from './interaction';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT_BOX);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
/** Onzichtbaar, maar wel aanklikbaar: raycasting kijkt niet naar de zichtbaarheid van het materiaal. */
const HIT_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });

export const COLORS = {
  accent: '#c6f432',
  select: '#2f7cf6',
  error: '#e5484d',
  warning: '#f5a524',
  zoneManufacturer: '#2f7cf6',
  zoneIndicative: '#8b929c',
} as const;

const obstacleMaterial = new THREE.MeshStandardMaterial({ color: '#a9aaa8', roughness: 0.95 });

/** Aanklikbare vlakken: de massieve delen van het toestel, iets ruimer genomen voor het gemak. */
function hitBoxes(item: PlacedItem, spec: PhysicalSpec) {
  const parts = spec.collisionParts?.length ? spec.collisionParts : [fullLocalBox(item.dimensions)];
  const pad = 0.025;
  const min = 0.14;
  return parts.map((p) => ({
    position: [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2] as [number, number, number],
    scale: [
      Math.max(p.x1 - p.x0 + 2 * pad, min),
      Math.max(p.y1 - p.y0 + 2 * pad, min),
      Math.max(p.z1 - p.z0 + 2 * pad, min),
    ] as [number, number, number],
  }));
}

function Outline({ w, d, h, color, fill = 0 }: { w: number; d: number; h: number; color: string; fill?: number }) {
  return (
    <group position={[0, h / 2, 0]}>
      <lineSegments geometry={UNIT_EDGES} scale={[w + 0.03, h + 0.03, d + 0.03]} renderOrder={5}>
        <lineBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
      </lineSegments>
      {fill > 0 && (
        <mesh geometry={UNIT_BOX} scale={[w + 0.02, h + 0.02, d + 0.02]} renderOrder={4}>
          <meshBasicMaterial color={color} transparent opacity={fill} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** Gekleurd vlak op de vloer onder een object. */
function FloorPatch({ w, d, y, color, opacity, offsetX = 0, offsetZ = 0 }: { w: number; d: number; y: number; color: string; opacity: number; offsetX?: number; offsetZ?: number }) {
  return (
    <mesh geometry={UNIT_PLANE} position={[offsetX, y, offsetZ]} rotation-x={-Math.PI / 2} scale={[w, d, 1]} renderOrder={2}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function ClearanceZone({ item, spec, blocked }: { item: PlacedItem; spec: PhysicalSpec; blocked: boolean }) {
  const c = spec.clearance!;
  const { width: w, depth: d } = item.dimensions;
  const zw = w + c.left + c.right;
  const zd = d + c.front + c.back;
  const ox = (c.right - c.left) / 2;
  const oz = (c.front - c.back) / 2;
  const color = blocked ? COLORS.warning : c.source === 'manufacturer' ? COLORS.zoneManufacturer : COLORS.zoneIndicative;
  const y = 0.008 - item.y;
  return (
    <group>
      <FloorPatch w={zw} d={zd} y={y} color={color} opacity={blocked ? 0.22 : 0.16} offsetX={ox} offsetZ={oz} />
      <lineSegments geometry={UNIT_EDGES} position={[ox, y, oz]} scale={[zw, 0.0001, zd]} renderOrder={3}>
        <lineBasicMaterial color={color} transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}

/** Ring met draaigreep rondom het geselecteerde apparaat. */
function RotateGizmo({ item }: { item: PlacedItem }) {
  const { width: w, depth: d } = item.dimensions;
  const radius = Math.hypot(w, d) / 2 + 0.2;
  const handlers = useRotateDrag({
    getCentre: () => useDesignStore.getState().design.items.find((i) => i.id === item.id) ?? null,
    onRotate: (deg) => useDesignStore.getState().updateItem(item.id, { rotationDeg: deg }, false),
  });
  const y = 0.012 - item.y;
  const { finish: _finish, ...events } = handlers;
  return (
    <group>
      <mesh position={[0, y, 0]} rotation-x={-Math.PI / 2} renderOrder={6}>
        <ringGeometry args={[radius - 0.012, radius + 0.012, 72]} />
        <meshBasicMaterial color={COLORS.select} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* Greep aan de voorzijde (+z) */}
      <group position={[0, y, radius]}>
        <mesh renderOrder={7} {...events}>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 28]} />
          <meshBasicMaterial color={COLORS.select} />
        </mesh>
        <mesh position={[0, 0.027, 0]} rotation-x={-Math.PI / 2} renderOrder={8}>
          <ringGeometry args={[0.035, 0.058, 24, 1, 0.5, Math.PI * 1.6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      <mesh position={[0, y, radius - 0.2]} rotation-x={-Math.PI / 2} scale={[0.02, 0.2, 1]} geometry={UNIT_PLANE} renderOrder={6}>
        <meshBasicMaterial color={COLORS.select} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface ItemObjectProps {
  item: PlacedItem;
  interactive: boolean;
  selected: boolean;
  severity: Severity | undefined;
  /** Gebruiksruimte tonen. */
  showZone: boolean;
  zoneBlocked: boolean;
}

export const ItemObject = memo(function ItemObject({ item, interactive, selected, severity, showZone, zoneBlocked }: ItemObjectProps) {
  const product = getProduct(item.productId);
  const { width: w, depth: d, height: h } = item.dimensions;
  const spec = specOf(item);

  const model = useMemo(() => {
    const instance = createModelInstance(product?.model, { width: w, depth: d, height: h });
    instance.name = 'model';
    return instance;
  }, [product, w, d, h]);

  const boxes = useMemo(() => hitBoxes(item, spec), [item.dimensions, spec]); // eslint-disable-line react-hooks/exhaustive-deps

  const drag = useFloorDrag({
    id: item.id,
    getPose: () => useDesignStore.getState().design.items.find((i) => i.id === item.id) ?? null,
    onSelect: () => useDesignStore.getState().select({ kind: 'item', id: item.id }),
    onMove: (x, z) => useDesignStore.getState().updateItem(item.id, { x, z }, false),
  });
  const { finish: _finish, ...events } = drag;

  const outlineColor = severity === 'error' ? COLORS.error : selected ? COLORS.select : null;

  return (
    <group name={`item:${item.id}`} position={[item.x, item.y, item.z]} rotation-y={degToRad(item.rotationDeg)}>
      <primitive object={model} />
      {interactive && boxes.map((b, i) => <mesh key={i} geometry={UNIT_BOX} material={HIT_MATERIAL} position={b.position} scale={b.scale} {...events} />)}
      {outlineColor && <Outline w={w} d={d} h={h} color={outlineColor} fill={severity === 'error' ? 0.16 : 0.05} />}
      {selected && <FloorPatch w={w + 0.08} d={d + 0.08} y={0.006 - item.y} color={severity === 'error' ? COLORS.error : COLORS.select} opacity={0.2} />}
      {!selected && severity === 'warning' && (
        <lineSegments geometry={UNIT_EDGES} position={[0, 0.01 - item.y, 0]} scale={[w + 0.1, 0.0001, d + 0.1]} renderOrder={3}>
          <lineBasicMaterial color={COLORS.warning} />
        </lineSegments>
      )}
      {showZone && hasClearance(spec) && <ClearanceZone item={item} spec={spec} blocked={zoneBlocked} />}
      {selected && interactive && <RotateGizmo item={item} />}
    </group>
  );
});

interface ObstacleObjectProps {
  obstacle: Obstacle;
  interactive: boolean;
  selected: boolean;
}

export const ObstacleObject = memo(function ObstacleObject({ obstacle, interactive, selected }: ObstacleObjectProps) {
  const { width: w, depth: d, height: h } = obstacle;
  const drag = useFloorDrag({
    id: obstacle.id,
    getPose: () => {
      const o = useDesignStore.getState().design.obstacles.find((x) => x.id === obstacle.id);
      return o ? { x: o.x, z: o.z, rotationDeg: o.rotationDeg, dimensions: { width: o.width, depth: o.depth, height: o.height } } : null;
    },
    onSelect: () => useDesignStore.getState().select({ kind: 'obstacle', id: obstacle.id }),
    onMove: (x, z) => useDesignStore.getState().updateObstacle(obstacle.id, { x, z }, false),
  });
  const { finish: _finish, ...events } = drag;
  return (
    <group name={`obstacle:${obstacle.id}`} position={[obstacle.x, 0, obstacle.z]} rotation-y={degToRad(obstacle.rotationDeg)}>
      <mesh geometry={UNIT_BOX} material={obstacleMaterial} position={[0, h / 2, 0]} scale={[w, h, d]} castShadow receiveShadow {...(interactive ? events : {})} />
      {selected && <Outline w={w} d={d} h={h} color={COLORS.select} fill={0.06} />}
    </group>
  );
});
