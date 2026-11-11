import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { wallFrame, wallLength } from '../domain/geometry/shapes';
import type { Opening, Room, WallId } from '../domain/types';
import { FLOOR_ROUGHNESS, createFloorTexture, isDarkFloor } from './textures';

export const WALL_THICKNESS = 0.1;
const WALLS: WallId[] = ['north', 'east', 'south', 'west'];

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const MAT_CAP = { color: '#3b3e42', roughness: 0.9 };
const frameMaterial = new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.6 });
const doorMaterial = new THREE.MeshStandardMaterial({ color: '#dcd3c2', roughness: 0.65 });
const garageMaterial = new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.5, metalness: 0.3 });
const handleMaterial = new THREE.MeshStandardMaterial({ color: '#2a2c2f', roughness: 0.4, metalness: 0.7 });
const glassMaterial = new THREE.MeshStandardMaterial({
  color: '#bcd9ea',
  roughness: 0.08,
  metalness: 0.1,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});
const slabMaterial = new THREE.MeshStandardMaterial({ color: '#4a4d51', roughness: 0.95 });

interface Segment {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

/** Verdeelt een muur in blokken rondom de deur- en raamopeningen. */
export function wallSegments(length: number, height: number, openings: Opening[], extend: number): Segment[] {
  const segments: Segment[] = [];
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  let cursor = -extend;
  for (const o of sorted) {
    const u0 = Math.max(o.offset, cursor, 0);
    const u1 = Math.min(o.offset + o.width, length);
    if (u1 - u0 < 0.01) continue;
    if (u0 - cursor > 0.001) segments.push({ u0: cursor, u1: u0, y0: 0, y1: height });
    if (o.sill > 0.001) segments.push({ u0, u1, y0: 0, y1: Math.min(o.sill, height) });
    const top = o.sill + o.height;
    if (height - top > 0.001) segments.push({ u0, u1, y0: top, y1: height });
    cursor = u1;
  }
  if (length + extend - cursor > 0.001) segments.push({ u0: cursor, u1: length + extend, y0: 0, y1: height });
  return segments;
}

interface WallTransform {
  position: [number, number, number];
  rotationY: number;
  /** Richting (in lokale z) waarin de muurdikte naar buiten loopt. */
  zSign: 1 | -1;
  extend: number;
}

function wallTransform(room: Room, wall: WallId): WallTransform {
  switch (wall) {
    case 'north':
      return { position: [0, 0, 0], rotationY: 0, zSign: -1, extend: WALL_THICKNESS };
    case 'south':
      return { position: [0, 0, room.length], rotationY: 0, zSign: 1, extend: WALL_THICKNESS };
    case 'west':
      return { position: [0, 0, 0], rotationY: -Math.PI / 2, zSign: 1, extend: 0 };
    case 'east':
      return { position: [room.width, 0, 0], rotationY: -Math.PI / 2, zSign: -1, extend: 0 };
  }
}

function DoorVisual({ o, z, zSign }: { o: Opening; z: number; zSign: 1 | -1 }) {
  const t = WALL_THICKNESS;
  const mid = o.offset + o.width / 2;
  const wide = o.width > 1.4;
  const inner = -zSign; // richting de ruimte in
  return (
    <group>
      <mesh geometry={UNIT_BOX} material={frameMaterial} position={[o.offset + 0.02, o.height / 2, z]} scale={[0.04, o.height, t + 0.02]} />
      <mesh geometry={UNIT_BOX} material={frameMaterial} position={[o.offset + o.width - 0.02, o.height / 2, z]} scale={[0.04, o.height, t + 0.02]} />
      <mesh geometry={UNIT_BOX} material={frameMaterial} position={[mid, o.height - 0.02, z]} scale={[o.width, 0.04, t + 0.02]} />
      <mesh
        geometry={UNIT_BOX}
        material={wide ? garageMaterial : doorMaterial}
        position={[mid, (o.height - 0.04) / 2, z]}
        scale={[o.width - 0.08, o.height - 0.04, 0.04]}
        receiveShadow
      />
      {wide ? (
        [0.25, 0.5, 0.75].map((f) => (
          <mesh key={f} geometry={UNIT_BOX} material={handleMaterial} position={[mid, o.height * f, z + inner * 0.021]} scale={[o.width - 0.1, 0.012, 0.004]} />
        ))
      ) : (
        <mesh geometry={UNIT_BOX} material={handleMaterial} position={[o.offset + o.width - 0.15, 1.05, z + inner * 0.04]} scale={[0.11, 0.022, 0.04]} />
      )}
    </group>
  );
}

function WindowVisual({ o, z, zSign }: { o: Opening; z: number; zSign: 1 | -1 }) {
  const t = WALL_THICKNESS;
  const mid = o.offset + o.width / 2;
  const cy = o.sill + o.height / 2;
  const f = 0.045;
  const inner = -zSign;
  return (
    <group>
      <mesh geometry={UNIT_BOX} material={frameMaterial} position={[o.offset + f / 2, cy, z]} scale={[f, o.height, t * 0.7]} />
      <mesh geometry={UNIT_BOX} material={frameMaterial} position={[o.offset + o.width - f / 2, cy, z]} scale={[f, o.height, t * 0.7]} />
      <mesh geometry={UNIT_BOX} material={frameMaterial} position={[mid, o.sill + f / 2, z]} scale={[o.width, f, t * 0.7]} />
      <mesh geometry={UNIT_BOX} material={frameMaterial} position={[mid, o.sill + o.height - f / 2, z]} scale={[o.width, f, t * 0.7]} />
      {o.width >= 1.4 && <mesh geometry={UNIT_BOX} material={frameMaterial} position={[mid, cy, z]} scale={[f * 0.8, o.height, t * 0.6]} />}
      <mesh geometry={UNIT_BOX} material={glassMaterial} position={[mid, cy, z]} scale={[o.width - f, o.height - f, 0.012]} />
      <mesh geometry={UNIT_BOX} material={frameMaterial} position={[mid, o.sill - 0.012, z + inner * (t / 2 + 0.04)]} scale={[o.width + 0.08, 0.024, 0.1]} />
    </group>
  );
}

function Wall({ room, wall, openings, hidden }: { room: Room; wall: WallId; openings: Opening[]; hidden: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<THREE.Group>(null);
  const details = useRef<THREE.Group>(null);
  const opacity = useRef(hidden ? 0 : 1);
  const xf = wallTransform(room, wall);
  const length = wallLength(room, wall);

  const wallMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.94 }), []);
  const capMaterial = useMemo(() => new THREE.MeshStandardMaterial(MAT_CAP), []);
  useEffect(() => () => {
    wallMaterial.dispose();
    capMaterial.dispose();
  }, [wallMaterial, capMaterial]);
  useEffect(() => {
    wallMaterial.color.set(room.wallColor);
    invalidate();
  }, [room.wallColor, wallMaterial, invalidate]);

  const segments = useMemo(() => wallSegments(length, room.height, openings, xf.extend), [length, room.height, openings, xf.extend]);

  useEffect(() => invalidate(), [hidden, invalidate]);

  // Zachte overgang bij het tonen en verbergen van de muur.
  useFrame((_, dt) => {
    const target = hidden ? 0 : 1;
    const current = opacity.current;
    if (current !== target) {
      const step = Math.min(dt, 0.05) * 6;
      opacity.current = target > current ? Math.min(target, current + step) : Math.max(target, current - step);
      invalidate();
    }
    const o = opacity.current;
    const transparent = o < 0.999;
    for (const m of [wallMaterial, capMaterial]) {
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.depthWrite = !transparent;
        m.needsUpdate = true;
      }
      m.opacity = o;
    }
    if (group.current) group.current.visible = o > 0.01;
    if (details.current) details.current.visible = o > 0.5;
  });

  const z = (xf.zSign * WALL_THICKNESS) / 2;
  return (
    <group ref={group} name={`wall:${wall}`} position={xf.position} rotation-y={xf.rotationY}>
      {segments.map((s, i) => (
        <mesh
          key={i}
          name="wall-segment"
          geometry={UNIT_BOX}
          material={wallMaterial}
          position={[(s.u0 + s.u1) / 2, (s.y0 + s.y1) / 2, z]}
          scale={[s.u1 - s.u0, s.y1 - s.y0, WALL_THICKNESS]}
          receiveShadow
        />
      ))}
      {segments
        .filter((s) => Math.abs(s.y1 - room.height) < 0.001)
        .map((s, i) => (
          <mesh key={i} geometry={UNIT_BOX} material={capMaterial} position={[(s.u0 + s.u1) / 2, room.height + 0.003, z]} scale={[s.u1 - s.u0, 0.006, WALL_THICKNESS]} />
        ))}
      <group ref={details}>
        {openings.map((o) =>
          o.kind === 'door' ? <DoorVisual key={o.id} o={o} z={z} zSign={xf.zSign} /> : <WindowVisual key={o.id} o={o} z={z} zSign={xf.zSign} />,
        )}
      </group>
    </group>
  );
}

/** Begin van de draaiboog per muur (hoek in het vloervlak), zie RingGeometry. */
const ARC_START: Record<WallId, number> = {
  north: (3 * Math.PI) / 2,
  south: 0,
  west: (3 * Math.PI) / 2,
  east: Math.PI,
};

/** Markering op de vloer: drempel en draaibereik van een deur. Blijft zichtbaar als de muur verborgen is. */
function DoorMarker({ room, opening }: { room: Room; opening: Opening }) {
  const f = wallFrame(room, opening.wall);
  const color = isDarkFloor(room.floor) ? '#ffffff' : '#1d1f22';
  const hinge: [number, number, number] = [f.start.x + f.along.x * opening.offset, 0.004, f.start.z + f.along.z * opening.offset];
  const mid = opening.offset + opening.width / 2;
  const alongX = f.along.x !== 0;
  return (
    <group>
      <mesh
        position={[f.start.x + f.along.x * mid + f.inward.x * 0.03, 0.004, f.start.z + f.along.z * mid + f.inward.z * 0.03]}
        scale={alongX ? [opening.width, 0.006, 0.06] : [0.06, 0.006, opening.width]}
        geometry={UNIT_BOX}
      >
        <meshBasicMaterial color={color} transparent opacity={0.75} />
      </mesh>
      {opening.swing === 'in' && (
        <>
          <mesh position={hinge} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[opening.width - 0.014, opening.width, 40, 1, ARC_START[opening.wall], Math.PI / 2]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
          </mesh>
          <mesh
            position={[hinge[0] + (f.inward.x * opening.width) / 2, 0.004, hinge[2] + (f.inward.z * opening.width) / 2]}
            scale={alongX ? [0.014, 0.004, opening.width] : [opening.width, 0.004, 0.014]}
            geometry={UNIT_BOX}
          >
            <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

interface RoomMeshProps {
  room: Room;
  openings: Opening[];
  hiddenWalls: Record<WallId, boolean>;
}

export function RoomMesh({ room, openings, hiddenWalls }: RoomMeshProps) {
  const invalidate = useThree((s) => s.invalidate);
  const texture = useMemo(() => createFloorTexture(room.floor, room.width, room.length), [room.floor, room.width, room.length]);
  useEffect(() => {
    invalidate();
    return () => texture.dispose();
  }, [texture, invalidate]);

  const byWall = useMemo(() => {
    const map: Record<WallId, Opening[]> = { north: [], east: [], south: [], west: [] };
    for (const o of openings) map[o.wall].push(o);
    return map;
  }, [openings]);

  const t = WALL_THICKNESS;
  return (
    <group>
      <mesh name="floor" position={[room.width / 2, 0, room.length / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[room.width, room.length]} />
        <meshStandardMaterial map={texture} roughness={FLOOR_ROUGHNESS[room.floor]} metalness={0} />
      </mesh>
      {/* Vloerplaat: de rand laat zien waar de muren staan, ook als ze verborgen zijn. */}
      <mesh
        geometry={UNIT_BOX}
        material={slabMaterial}
        position={[room.width / 2, -0.051, room.length / 2]}
        scale={[room.width + 2 * t, 0.1, room.length + 2 * t]}
        receiveShadow
      />
      {WALLS.map((wall) => (
        <Wall key={wall} room={room} wall={wall} openings={byWall[wall]} hidden={hiddenWalls[wall]} />
      ))}
      {openings
        .filter((o) => o.kind === 'door')
        .map((o) => (
          <DoorMarker key={o.id} room={room} opening={o} />
        ))}
    </group>
  );
}
