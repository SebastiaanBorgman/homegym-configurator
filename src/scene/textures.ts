import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRng } from '../domain/layout/autoLayout';
import type { FloorFinish } from '../domain/types';

/**
 * Procedurele vloertexturen: ter plekke getekend op een canvas, dus zonder externe bestanden.
 * Eén tegel van de textuur staat voor 1 × 1 meter.
 */

const SIZE = 512;
const canvasCache = new Map<FloorFinish, HTMLCanvasElement>();

function drawRubber(ctx: CanvasRenderingContext2D, rng: () => number) {
  ctx.fillStyle = '#2b2d30';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // EPDM-spikkels
  for (let i = 0; i < 2600; i++) {
    const tone = rng();
    ctx.fillStyle = tone > 0.82 ? 'rgba(150,170,190,0.55)' : tone > 0.5 ? 'rgba(90,96,104,0.5)' : 'rgba(18,19,21,0.6)';
    const r = 0.6 + rng() * 1.5;
    ctx.fillRect(rng() * SIZE, rng() * SIZE, r, r);
  }
  // naden van de tegels (1 × 1 m)
  ctx.strokeStyle = 'rgba(8,8,9,0.75)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, SIZE, SIZE);
}

function drawWood(ctx: CanvasRenderingContext2D, rng: () => number) {
  const planks = 5;
  const pw = SIZE / planks;
  for (let i = 0; i < planks; i++) {
    const offset = rng() * SIZE;
    for (const start of [offset - SIZE, offset]) {
      const light = 150 + rng() * 26;
      ctx.fillStyle = `rgb(${light + 38}, ${light + 4}, ${light - 44})`;
      ctx.fillRect(i * pw, start, pw, SIZE);
      // nerven
      for (let g = 0; g < 22; g++) {
        ctx.strokeStyle = `rgba(96,62,30,${0.05 + rng() * 0.09})`;
        ctx.lineWidth = 0.6 + rng();
        const x = i * pw + rng() * pw;
        ctx.beginPath();
        ctx.moveTo(x, start);
        ctx.bezierCurveTo(x + rng() * 6 - 3, start + SIZE * 0.3, x + rng() * 6 - 3, start + SIZE * 0.7, x + rng() * 4 - 2, start + SIZE);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(60,38,18,0.55)';
      ctx.fillRect(i * pw, start, pw, 1.5);
    }
    ctx.fillStyle = 'rgba(60,38,18,0.5)';
    ctx.fillRect(i * pw, 0, 1.5, SIZE);
  }
}

function drawSpeckled(ctx: CanvasRenderingContext2D, rng: () => number, base: string, dark: string, light: string, count: number) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 26; i++) {
    const cx = rng() * SIZE;
    const cy = rng() * SIZE;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 + rng() * 150);
    g.addColorStop(0, rng() > 0.5 ? dark : light);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng() > 0.5 ? dark : light;
    ctx.fillRect(rng() * SIZE, rng() * SIZE, 1, 1);
  }
}

function floorCanvas(finish: FloorFinish): HTMLCanvasElement {
  const cached = canvasCache.get(finish);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const rng = createRng(finish.length * 977 + finish.charCodeAt(0));
  if (finish === 'rubber') drawRubber(ctx, rng);
  else if (finish === 'hout') drawWood(ctx, rng);
  else if (finish === 'beton') drawSpeckled(ctx, rng, '#a3a5a6', 'rgba(70,72,74,0.05)', 'rgba(225,226,227,0.06)', 5000);
  else drawSpeckled(ctx, rng, '#d6d0c4', 'rgba(150,140,124,0.04)', 'rgba(248,246,240,0.06)', 2500);
  canvasCache.set(finish, canvas);
  return canvas;
}

export const FLOOR_ROUGHNESS: Record<FloorFinish, number> = { rubber: 0.92, hout: 0.62, beton: 0.85, vinyl: 0.55 };

/** Vloertextuur voor een ruimte van width × length meter. */
export function createFloorTexture(finish: FloorFinish, width: number, length: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(floorCanvas(finish));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width, length);
  texture.anisotropy = 8;
  return texture;
}

/** True als hulplijnen op deze vloer beter licht dan donker kunnen zijn. */
export const isDarkFloor = (finish: FloorFinish) => finish === 'rubber';

const environments = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/**
 * Omgevingslicht voor realistische reflecties op staal en chroom. Wordt ter plekke gegenereerd
 * (een eenvoudige studio-ruimte), dus zonder HDR-bestand of netwerkverzoek.
 */
export function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const cached = environments.get(renderer);
  if (cached) return cached;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  environments.set(renderer, texture);
  return texture;
}
