import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { getProduct } from '../catalog';
import { createModelInstance } from '../models';
import { studioEnvironment } from './textures';

/**
 * Productafbeeldingen als eigen 3D-illustratie.
 *
 * In plaats van foto's van fabrikanten (auteursrecht) tekenen we elk product met hetzelfde
 * vereenvoudigde 3D-model als in de configurator. Eén verborgen renderer maakt de plaatjes
 * één voor één, buiten de hoofdweergave om; het resultaat wordt in het geheugen bewaard.
 * Lukt het niet (geen WebGL), dan toont de interface een neutraal pictogram.
 */

const SIZE = 320;
const cache = new Map<string, string | null>();
const queue: string[] = [];
const listeners = new Set<() => void>();
let busy = false;
let failed = false;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

function setup(): boolean {
  if (renderer) return true;
  if (failed) return false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    scene.environmentIntensity = 0.75;
    scene.add(new THREE.HemisphereLight('#ffffff', '#c8c2b8', 1.0));

    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(2.5, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    const sc = key.shadow.camera;
    sc.left = -3;
    sc.right = 3;
    sc.top = 3;
    sc.bottom = -3;
    sc.far = 20;
    scene.add(key);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    camera = new THREE.PerspectiveCamera(26, 1, 0.05, 80);
    return true;
  } catch {
    failed = true;
    renderer = null;
    return false;
  }
}

function render(productId: string): string | null {
  const product = getProduct(productId);
  if (!product || !setup() || !renderer || !scene || !camera) return null;
  try {
    const { width: w, depth: d, height: h } = product.dimensions;
    const model = createModelInstance(product.model, product.dimensions);
    scene.add(model);

    // Camera zo plaatsen dat de omhullende bol van het product precies in beeld past.
    const radius = Math.hypot(w, d, h) / 2;
    const direction = new THREE.Vector3(0.95, 0.62, 1.2).normalize();
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.04;
    camera.position.copy(direction.multiplyScalar(distance)).add(new THREE.Vector3(0, h / 2, 0));
    camera.lookAt(0, h / 2, 0);
    camera.near = Math.max(0.02, distance - radius * 2);
    camera.far = distance + radius * 4;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(model);
    return url;
  } catch {
    return null;
  }
}

function pump() {
  if (busy) return;
  busy = true;
  const step = () => {
    const id = queue.shift();
    if (id === undefined) {
      busy = false;
      return;
    }
    cache.set(id, render(id));
    listeners.forEach((l) => l());
    setTimeout(step, 0); // de interface tussendoor laten ademen
  };
  setTimeout(step, 0);
}

function request(productId: string) {
  if (cache.has(productId) || queue.includes(productId)) return;
  queue.push(productId);
  pump();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Geeft de afbeelding van een product:
 * - undefined: wordt nog gemaakt (toon een laadindicator)
 * - null:      niet beschikbaar (toon een pictogram)
 * - string:    data-URL van de afbeelding
 */
export function useThumbnail(productId: string): string | null | undefined {
  const value = useSyncExternalStore(
    subscribe,
    () => cache.get(productId),
    () => undefined,
  );
  if (value === undefined && typeof window !== 'undefined') request(productId);
  return value;
}
