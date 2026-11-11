import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Bouwpakket voor procedurele 3D-modellen.
 *
 * Alle modellen worden opgebouwd uit een handvol gedeelde eenheidsgeometrieën die per onderdeel
 * worden geschaald. Dat houdt het geheugen- en GPU-gebruik laag: honderd balken delen één
 * BoxGeometry. Maten zijn in meters; het model staat met het midden van zijn voetafdruk op de
 * oorsprong, de vloer op y = 0 en de voorzijde richting +z.
 */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
const UNIT_CYL_FINE = new THREE.CylinderGeometry(1, 1, 1, 40);
const UNIT_CYL_HEX = new THREE.CylinderGeometry(1, 1, 1, 6);
const UNIT_SPHERE = new THREE.SphereGeometry(1, 20, 14);

function mat(color: string, metalness: number, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

/** Gedeelde materialen. Bewust zonder texturen: licht, snel en bruikbaar buiten de browser (tests). */
export const MAT = {
  steelBlack: mat('#1a1b1e', 0.55, 0.48),
  steelDark: mat('#2c2f33', 0.6, 0.45),
  steelGrey: mat('#80868c', 0.75, 0.4),
  chrome: mat('#d9dce0', 1.0, 0.16),
  alu: mat('#b5babf', 0.85, 0.34),
  rubber: mat('#131313', 0.0, 0.95),
  rubberAlt: mat('#1e1e1f', 0.0, 0.88),
  rubberGrey: mat('#3b3d40', 0.0, 0.9),
  pad: mat('#101113', 0.0, 0.55),
  plasticDark: mat('#202226', 0.1, 0.6),
  plasticGrey: mat('#5d6268', 0.1, 0.55),
  plasticLight: mat('#c9ccd0', 0.05, 0.5),
  accentRed: mat('#c9382e', 0.2, 0.5),
  accentGreen: mat('#8fc63f', 0.2, 0.5),
  wood: mat('#d4b483', 0.0, 0.78),
  woodEdge: mat('#b89561', 0.0, 0.8),
  screen: mat('#0c1b26', 0.2, 0.3, { emissive: new THREE.Color('#2a86c4'), emissiveIntensity: 0.55 }),
  belt: mat('#0f0f10', 0.0, 0.86),
  neutral: mat('#9aa0a6', 0.1, 0.7),
} as const;

export type Axis = 'x' | 'y' | 'z';
export type V3 = [number, number, number];

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class Kit {
  readonly group = new THREE.Group();

  constructor(
    /** Breedte (x), diepte (z) en hoogte (y) van het product in meters. */
    readonly w: number,
    readonly d: number,
    readonly h: number,
  ) {}

  private push(mesh: THREE.Mesh): THREE.Mesh {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  /** Blok met middelpunt (x, y, z). */
  box(sx: number, sy: number, sz: number, x: number, y: number, z: number, material: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(UNIT_BOX, material);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    return this.push(m);
  }

  /** Blok waarvan de onderkant op hoogte y0 ligt. */
  boxUp(sx: number, sy: number, sz: number, x: number, y0: number, z: number, material: THREE.Material): THREE.Mesh {
    return this.box(sx, sy, sz, x, y0 + sy / 2, z, material);
  }

  /** Blok met afgeronde randen (kussens, zadels). */
  rounded(sx: number, sy: number, sz: number, x: number, y: number, z: number, material: THREE.Material, radius = 0.018): THREE.Mesh {
    const r = Math.min(radius, sx / 2.01, sy / 2.01, sz / 2.01);
    const m = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 3, r), material);
    m.position.set(x, y, z);
    return this.push(m);
  }

  /** Cilinder langs een hoofdas met middelpunt (x, y, z). */
  cyl(
    radius: number,
    length: number,
    axis: Axis,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    quality: 'normal' | 'fine' | 'hex' = 'normal',
  ): THREE.Mesh {
    const geometry = quality === 'fine' ? UNIT_CYL_FINE : quality === 'hex' ? UNIT_CYL_HEX : UNIT_CYL;
    const m = new THREE.Mesh(geometry, material);
    m.scale.set(radius, length, radius);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    else if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    return this.push(m);
  }

  /** Vierkante balk tussen twee punten (mag schuin lopen). */
  beam(a: V3, b: V3, size: number, material: THREE.Material, sizeB = size): THREE.Mesh {
    const from = new THREE.Vector3(...a);
    const to = new THREE.Vector3(...b);
    const dir = to.clone().sub(from);
    const m = new THREE.Mesh(UNIT_BOX, material);
    m.scale.set(size, dir.length(), sizeB);
    m.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
    m.position.copy(from.add(to).multiplyScalar(0.5));
    return this.push(m);
  }

  /** Ronde stang tussen twee punten (mag schuin lopen). */
  rod(a: V3, b: V3, radius: number, material: THREE.Material): THREE.Mesh {
    const from = new THREE.Vector3(...a);
    const to = new THREE.Vector3(...b);
    const dir = to.clone().sub(from);
    const m = new THREE.Mesh(UNIT_CYL, material);
    m.scale.set(radius, dir.length(), radius);
    m.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
    m.position.copy(from.add(to).multiplyScalar(0.5));
    return this.push(m);
  }

  /** Ellipsoïde met halve assen (rx, ry, rz). */
  sphere(rx: number, ry: number, rz: number, x: number, y: number, z: number, material: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(UNIT_SPHERE, material);
    m.scale.set(rx, ry, rz);
    m.position.set(x, y, z);
    return this.push(m);
  }
}

export interface ModelFit {
  /** Schaalfactor per as die nodig was om exact op de productmaten uit te komen (≈ 1). */
  sx: number;
  sy: number;
  sz: number;
  /** Grootste afwijking van 1, als fractie. */
  deviation: number;
}

/** Exacte omhullende van een object, op basis van alle hoekpunten. */
export function measure(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object, true);
}

/**
 * Sluit een model af: centreert de voetafdruk op de oorsprong, zet de onderkant op y = 0 en
 * past — als vangnet — de buitenmaten exact aan op de productmaten. De bouwfuncties horen zelf
 * al precies op maat te bouwen; de tests bewaken dat de correctie verwaarloosbaar blijft.
 */
export function finalize(kit: Kit): THREE.Group {
  const bounds = measure(kit.group);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());

  const inner = kit.group;
  inner.position.set(-centre.x, -bounds.min.y, -centre.z);

  const fit: ModelFit = {
    sx: size.x > 0 ? kit.w / size.x : 1,
    sy: size.y > 0 ? kit.h / size.y : 1,
    sz: size.z > 0 ? kit.d / size.z : 1,
    deviation: 0,
  };
  fit.deviation = Math.max(Math.abs(fit.sx - 1), Math.abs(fit.sy - 1), Math.abs(fit.sz - 1));

  const outer = new THREE.Group();
  outer.add(inner);
  outer.scale.set(fit.sx, fit.sy, fit.sz);
  outer.userData.fit = fit;
  outer.updateMatrixWorld(true);
  return outer;
}
