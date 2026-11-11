import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Design, Room, WallId } from '../domain/types';
import { measure } from '../models';
import { derive } from '../state/derived';
import { useDesignStore } from '../state/designStore';
import { useUiStore, type CameraPreset } from '../state/uiStore';
import { sceneApi, type SceneInfo } from './bridge';
import type { ControlsLike } from './interaction';
import { COLORS, ItemObject, ObstacleObject } from './ItemObject';
import { labelAnchors, labelBus } from './labels';
import { RoomMesh } from './RoomMesh';
import { isDarkFloor, studioEnvironment } from './textures';

export interface GymSceneProps {
  design: Design;
  /** Bewerken (selecteren, slepen, draaien) aan of uit. */
  interactive?: boolean;
  /** Langzaam ronddraaiende presentatie, bijv. op de homepage. */
  autoRotate?: boolean;
  /** Stopt met renderen (bijv. wanneer de weergave buiten beeld is). */
  paused?: boolean;
}

const FOV = 38;
const NONE_HIDDEN: Record<WallId, boolean> = { north: false, east: false, south: false, west: false };
const ALL_HIDDEN: Record<WallId, boolean> = { north: true, east: true, south: true, west: true };

// ─────────────────────────────────── Belichting ───────────────────────────────────

function Lights({ room }: { room: Room }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  const cx = room.width / 2;
  const cz = room.length / 2;
  const reach = Math.hypot(room.width, room.length) / 2 + 1.5;

  useEffect(() => {
    const light = key.current;
    if (!light) return;
    light.target.position.set(cx, 0, cz);
    light.target.updateMatrixWorld();
    const cam = light.shadow.camera;
    cam.left = -reach;
    cam.right = reach;
    cam.top = reach;
    cam.bottom = -reach;
    cam.near = 0.5;
    cam.far = 45;
    cam.updateProjectionMatrix();
    invalidate();
  }, [cx, cz, reach, invalidate]);

  return (
    <>
      <hemisphereLight args={['#ffffff', '#b9b1a4', 0.8]} />
      <directionalLight
        ref={key}
        position={[cx + 3, 11, cz + 4]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[cx - 6, 5, cz - 5]} intensity={0.45} />
    </>
  );
}

// ───────────────────────────────────── Camera ─────────────────────────────────────

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function poseFor(preset: CameraPreset, room: Room, aspect: number, closeUp = false): CameraPose | null {
  const { width: W, length: L, height: H } = room;
  const centre = new THREE.Vector3(W / 2, 0, L / 2);
  const diagonal = Math.hypot(W, L, H);
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  // Op smalle schermen verder weg, zodat de hele ruimte in beeld blijft.
  const narrow = Math.max(1, 1.25 / Math.max(aspect, 0.4));
  switch (preset) {
    case 'standaard': {
      const target = centre.clone().setY(H * 0.3);
      const dir = new THREE.Vector3(0.62, 0.6, 0.9).normalize();
      return { target, position: target.clone().addScaledVector(dir, (diagonal * (closeUp ? 0.47 : 0.5) * narrow) / tan) };
    }
    case 'laag': {
      const target = centre.clone().setY(H * 0.4);
      const dir = new THREE.Vector3(0.55, 0.16, 0.9).normalize();
      return { target, position: target.clone().addScaledVector(dir, (diagonal * 0.5 * narrow) / tan) };
    }
    case 'boven': {
      const fitLength = (L / 2 + 0.9) / tan;
      const fitWidth = (W / 2 + 0.9) / (tan * Math.max(aspect, 0.4));
      // De bovenkant van de muren ligt dichter bij de camera en moet ook in beeld passen.
      const distance = Math.max(fitLength, fitWidth) + H;
      return { target: centre.clone(), position: new THREE.Vector3(W / 2, distance, L / 2 + 0.01) };
    }
    case 'binnen': {
      // Ooghoogte, vanuit de hoek voorwand/rechterwand de ruimte in kijkend.
      return {
        position: new THREE.Vector3(W - Math.min(0.5, W * 0.15), Math.min(1.65, H - 0.2), L - Math.min(0.5, L * 0.12)),
        target: new THREE.Vector3(W * 0.3, Math.min(1.0, H * 0.4), L * 0.25),
      };
    }
    default:
      return null;
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface CameraRigProps {
  room: Room;
  interactive: boolean;
  autoRotate: boolean;
  onHiddenWalls: (hidden: Record<WallId, boolean>) => void;
}

function CameraRig({ room, interactive, autoRotate, onHiddenWalls }: CameraRigProps) {
  const controls = useRef<ControlsLike | null>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const command = useUiStore((s) => s.cameraCommand);
  const animation = useRef<{ fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number } | null>(null);
  const previousRoom = useRef<Room | null>(null);
  const hidden = useRef(NONE_HIDDEN);
  const lastNonce = useRef(command.nonce);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  const updateHidden = useCallback(() => {
    const p = camera.position;
    const next: Record<WallId, boolean> = {
      north: p.z < 0,
      south: p.z > room.length,
      west: p.x < 0,
      east: p.x > room.width,
    };
    const h = hidden.current;
    if (next.north !== h.north || next.south !== h.south || next.west !== h.west || next.east !== h.east) {
      hidden.current = next;
      onHiddenWalls(next);
    }
  }, [camera, room.length, room.width, onHiddenWalls]);

  const animateTo = useCallback(
    (pose: CameraPose) => {
      const c = controls.current;
      if (!c) return;
      animation.current = { fromPos: camera.position.clone(), toPos: pose.position, fromTarget: c.target.clone(), toTarget: pose.target, t: 0 };
      invalidate();
    },
    [camera, invalidate],
  );

  // Eerste beeld, en meebewegen wanneer de afmetingen van de ruimte veranderen.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const before = previousRoom.current;
    previousRoom.current = room;
    if (!before) {
      const pose = poseFor('standaard', room, aspectRef.current, !interactive)!;
      camera.position.copy(pose.position);
      c.target.copy(pose.target);
      c.update();
      updateHidden();
      invalidate();
      return;
    }
    if (before.width === room.width && before.length === room.length && before.height === room.height) return;
    // Zelfde kijkrichting behouden, maar opnieuw centreren en de afstand meeschalen.
    const oldCentre = new THREE.Vector3(before.width / 2, 0, before.length / 2);
    const newCentre = new THREE.Vector3(room.width / 2, 0, room.length / 2);
    const scale = Math.hypot(room.width, room.length, room.height) / Math.hypot(before.width, before.length, before.height);
    const target = c.target.clone().sub(oldCentre).multiplyScalar(scale).add(newCentre);
    const offset = camera.position.clone().sub(c.target).multiplyScalar(scale);
    animateTo({ target, position: target.clone().add(offset) });
  }, [room, camera, interactive, animateTo, updateHidden, invalidate]);

  // Opdrachten van de cameraknoppen.
  useEffect(() => {
    if (command.nonce === lastNonce.current) return;
    lastNonce.current = command.nonce;
    const c = controls.current;
    if (!c || !interactive) return;
    if (command.preset === 'zoom-in' || command.preset === 'zoom-uit') {
      const offset = camera.position.clone().sub(c.target);
      const factor = command.preset === 'zoom-in' ? 0.75 : 1.33;
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 1, 45));
      animateTo({ target: c.target.clone(), position: c.target.clone().add(offset) });
      return;
    }
    const pose = poseFor(command.preset, room, aspectRef.current);
    if (pose) animateTo(pose);
  }, [command, room, camera, interactive, animateTo]);

  useFrame((_, dt) => {
    const a = animation.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + Math.min(dt, 0.05) / 0.6);
    const k = easeInOut(a.t);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    c.target.lerpVectors(a.fromTarget, a.toTarget, k);
    c.update();
    if (a.t >= 1) animation.current = null;
    updateHidden();
    invalidate();
  });

  return (
    <OrbitControls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={controls as any}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.7}
      zoomSpeed={0.9}
      panSpeed={0.9}
      screenSpacePanning={false}
      minDistance={1}
      maxDistance={45}
      maxPolarAngle={Math.PI / 2 - 0.02}
      enableZoom={interactive}
      enablePan={interactive}
      autoRotate={autoRotate}
      autoRotateSpeed={0.55}
      onStart={() => {
        animation.current = null; // de gebruiker neemt het over
      }}
      onChange={updateHidden}
    />
  );
}

// ────────────────────────────────── Hulplijnen en labels ──────────────────────────────────

function useLineGeometry(points: number[]) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return g;
  }, [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function SnapGuides({ room }: { room: Room }) {
  const guides = useUiStore((s) => s.snapGuides);
  const points = useMemo(() => {
    const p: number[] = [];
    const m = 0.25;
    for (const g of guides) {
      if (g.axis === 'x') p.push(g.value, 0.02, -m, g.value, 0.02, room.length + m);
      else p.push(-m, 0.02, g.value, room.width + m, 0.02, g.value);
    }
    return p;
  }, [guides, room.length, room.width]);
  const geometry = useLineGeometry(points);
  if (!guides.length) return null;
  return (
    <lineSegments geometry={geometry} renderOrder={9}>
      <lineBasicMaterial color={COLORS.accent} depthTest={false} transparent opacity={0.95} />
    </lineSegments>
  );
}

function GridOverlay({ room, size }: { room: Room; size: number }) {
  const points = useMemo(() => {
    const p: number[] = [];
    for (let x = size; x < room.width - 1e-6; x += size) p.push(x, 0.003, 0, x, 0.003, room.length);
    for (let z = size; z < room.length - 1e-6; z += size) p.push(0, 0.003, z, room.width, 0.003, z);
    return p;
  }, [room.width, room.length, size]);
  const geometry = useLineGeometry(points);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={isDarkFloor(room.floor) ? '#ffffff' : '#000000'} transparent opacity={0.16} />
    </lineSegments>
  );
}

/** Zet de HTML-labels op hun plek: projecteert hun positie in de ruimte naar het scherm. */
function LabelProjector() {
  const invalidate = useThree((s) => s.invalidate);
  const point = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    labelBus.invalidate = () => invalidate();
    invalidate();
    return () => {
      labelBus.invalidate = () => {};
    };
  }, [invalidate]);
  useFrame(({ camera, size }) => {
    if (!labelAnchors.size) return;
    camera.updateMatrixWorld();
    for (const anchor of labelAnchors) {
      point.set(anchor.position[0], anchor.position[1], anchor.position[2]).project(camera);
      const visible = point.z > -1 && point.z < 1;
      const x = ((point.x + 1) / 2) * size.width;
      const y = ((1 - point.y) / 2) * size.height;
      anchor.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      anchor.el.style.opacity = visible ? '1' : '0';
    }
  });
  return null;
}

/** Maatlijnen langs de vloer; de bijbehorende teksten staan in de HTML-labellaag. */
function RoomDimensionLines({ room }: { room: Room }) {
  const m = 0.34;
  const tick = 0.08;
  const points = useMemo(
    () => [
      // breedte (voorzijde)
      0, 0, room.length + m, room.width, 0, room.length + m,
      0, 0, room.length + m - tick, 0, 0, room.length + m + tick,
      room.width, 0, room.length + m - tick, room.width, 0, room.length + m + tick,
      // lengte (rechterzijde)
      room.width + m, 0, 0, room.width + m, 0, room.length,
      room.width + m - tick, 0, 0, room.width + m + tick, 0, 0,
      room.width + m - tick, 0, room.length, room.width + m + tick, 0, room.length,
    ],
    [room.width, room.length],
  );
  const geometry = useLineGeometry(points);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#5f656c" />
    </lineSegments>
  );
}

// ───────────────────────────── Koppeling met interface en tests ─────────────────────────────

function SceneBridge() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const v = (p: THREE.Vector3) => ({ x: p.x, y: p.y, z: p.z });
    sceneApi.current = {
      capture: () => {
        const { gl, scene, camera } = get();
        try {
          gl.render(scene, camera);
          return gl.domElement.toDataURL('image/png');
        } catch {
          return null;
        }
      },
      info: () => {
        const { scene } = get();
        scene.updateMatrixWorld(true);
        const info: SceneInfo = { floor: null, wallHeights: {}, items: [] };
        scene.traverse((o) => {
          if (o.name === 'floor') {
            const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
            info.floor = { width: size.x, length: size.z };
          } else if (o.name.startsWith('wall:')) {
            const box = new THREE.Box3();
            for (const child of o.children) if (child.name === 'wall-segment') box.expandByObject(child);
            if (!box.isEmpty()) info.wallHeights[o.name.slice(5)] = box.max.y - Math.max(0, box.min.y);
          } else if (o.name.startsWith('item:')) {
            const model = o.getObjectByName('model');
            if (!model) return;
            const box = measure(model);
            info.items.push({ id: o.name.slice(5), size: v(box.getSize(new THREE.Vector3())), min: v(box.min), max: v(box.max) });
          }
        });
        return info;
      },
      project: (x, y, z) => {
        const { camera, gl } = get();
        camera.updateMatrixWorld();
        const p = new THREE.Vector3(x, y, z).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
      },
      camera: () => {
        const { camera, controls } = get();
        const target = (controls as unknown as ControlsLike | null)?.target ?? new THREE.Vector3();
        return { position: v(camera.position), target: v(target) };
      },
    };
    return () => {
      sceneApi.current = null;
    };
  }, [get]);
  return null;
}

// ─────────────────────────────────────── Scène ───────────────────────────────────────

function SceneContents({ design, interactive, autoRotate, paused }: Required<GymSceneProps>) {
  const { room } = design;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    scene.environment = studioEnvironment(gl);
    scene.environmentIntensity = 0.5;
    invalidate();
  }, [gl, scene, invalidate]);

  const [autoHidden, setAutoHidden] = useState(NONE_HIDDEN);
  const wallMode = useUiStore((s) => s.wallMode);
  const showAllZones = useUiStore((s) => s.showAllZones);
  const showLabels = useUiStore((s) => s.showLabels);
  const snapGrid = useUiStore((s) => s.snapGrid);
  const gridSize = useUiStore((s) => s.gridSize);
  const selection = useDesignStore((s) => s.selection);

  const hiddenWalls = !interactive || wallMode === 'auto' ? autoHidden : wallMode === 'vol' ? NONE_HIDDEN : ALL_HIDDEN;
  const derived = interactive ? derive(design) : null;
  const blockedZones = useMemo(
    () => new Set(derived?.issues.filter((i) => i.code === 'CLEARANCE').map((i) => i.itemIds[0]) ?? []),
    [derived],
  );

  // Elke wijziging in het ontwerp vraagt om een nieuw beeld (we renderen alleen op aanvraag).
  useEffect(() => invalidate(), [design, selection, hiddenWalls, showAllZones, showLabels, snapGrid, gridSize, paused, invalidate]);

  return (
    <>
      <Lights room={room} />
      <RoomMesh room={room} openings={design.openings} hiddenWalls={hiddenWalls} />
      {design.obstacles.map((o) => (
        <ObstacleObject key={o.id} obstacle={o} interactive={interactive} selected={interactive && selection?.id === o.id} />
      ))}
      {design.items.map((item) => {
        const selected = interactive && selection?.id === item.id;
        return (
          <ItemObject
            key={item.id}
            item={item}
            interactive={interactive}
            selected={selected}
            severity={derived?.severityByItem.get(item.id)}
            showZone={interactive && (selected || showAllZones)}
            zoneBlocked={blockedZones.has(item.id)}
          />
        );
      })}
      {interactive && <SnapGuides room={room} />}
      {interactive && snapGrid && <GridOverlay room={room} size={gridSize} />}
      {interactive && showLabels && <RoomDimensionLines room={room} />}
      {interactive && <LabelProjector />}
      <CameraRig room={room} interactive={interactive} autoRotate={autoRotate} onHiddenWalls={setAutoHidden} />
      {interactive && <SceneBridge />}
    </>
  );
}

export default function GymScene({ design, interactive = true, autoRotate = false, paused = false }: GymSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={paused ? 'never' : autoRotate ? 'always' : 'demand'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping }}
      camera={{ fov: FOV, near: 0.1, far: 160, position: [8, 7, 12] }}
      onPointerMissed={() => {
        if (interactive) useDesignStore.getState().select(null);
      }}
      style={{ touchAction: 'none' }}
    >
      <SceneContents design={design} interactive={interactive} autoRotate={autoRotate} paused={paused} />
    </Canvas>
  );
}
