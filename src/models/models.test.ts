import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../catalog';
import type { ModelKind } from '../catalog/types';
import { BUILDERS } from './builders';
import { createModelInstance, getModelTemplate, measure, modelFit } from './index';

const MM = 0.001;

describe('3D-modellen op ware grootte', () => {
  it('heeft voor elk product een eigen model', () => {
    for (const p of PRODUCTS) {
      expect(BUILDERS[p.model.kind], p.id).toBeTypeOf('function');
      expect(p.model.kind, p.id).not.toBe('box');
    }
  });

  it('geeft elk model exact de buitenmaten van het product (binnen 1 mm)', () => {
    for (const p of PRODUCTS) {
      const size = measure(getModelTemplate(p.model, p.dimensions)).getSize(new THREE.Vector3());
      expect(Math.abs(size.x - p.dimensions.width), `${p.id} breedte ${size.x} ≠ ${p.dimensions.width}`).toBeLessThan(MM);
      expect(Math.abs(size.z - p.dimensions.depth), `${p.id} diepte ${size.z} ≠ ${p.dimensions.depth}`).toBeLessThan(MM);
      expect(Math.abs(size.y - p.dimensions.height), `${p.id} hoogte ${size.y} ≠ ${p.dimensions.height}`).toBeLessThan(MM);
    }
  });

  it('bouwt de modellen zelf al op maat: de eindcorrectie blijft onder 1%', () => {
    for (const p of PRODUCTS) {
      const fit = modelFit(getModelTemplate(p.model, p.dimensions))!;
      expect(fit.deviation, `${p.id}: sx=${fit.sx} sy=${fit.sy} sz=${fit.sz}`).toBeLessThan(0.01);
    }
  });

  it('zet elk model met de onderkant op de vloer en de voetafdruk gecentreerd', () => {
    for (const p of PRODUCTS) {
      const box = measure(getModelTemplate(p.model, p.dimensions));
      expect(Math.abs(box.min.y), p.id).toBeLessThan(MM);
      expect(Math.abs(box.min.x + box.max.x), p.id).toBeLessThan(MM);
      expect(Math.abs(box.min.z + box.max.z), p.id).toBeLessThan(MM);
    }
  });

  it('behoudt de maten na plaatsen en draaien', () => {
    const p = PRODUCTS.find((x) => x.id === 'rogue-rml-390f')!;
    const { width, depth, height } = p.dimensions;

    const instance = createModelInstance(p.model, p.dimensions);
    const holder = new THREE.Group();
    holder.add(instance);
    holder.position.set(2, 0, 3);

    // 90° gedraaid: breedte en diepte wisselen van as, de hoogte blijft gelijk.
    holder.rotation.y = Math.PI / 2;
    const turned = measure(holder).getSize(new THREE.Vector3());
    expect(turned.x).toBeCloseTo(depth, 3);
    expect(turned.z).toBeCloseTo(width, 3);
    expect(turned.y).toBeCloseTo(height, 3);
    expect(height).toBeCloseTo(2.34315, 9); // 92,25 inch

    // Schuine hoek: de omhullende wordt groter, maar het model zelf wordt niet geschaald.
    holder.rotation.y = THREE.MathUtils.degToRad(37);
    holder.updateMatrixWorld(true);
    const scale = new THREE.Vector3();
    holder.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    expect(scale.x).toBeCloseTo(1, 9);
    expect(scale.y).toBeCloseTo(1, 9);
    expect(scale.z).toBeCloseTo(1, 9);
    expect(measure(holder).getSize(new THREE.Vector3()).y).toBeCloseTo(height, 3);
  });

  it('valt terug op een blok op ware grootte bij een onbekend of kapot model', () => {
    const dims = { width: 1.2, depth: 0.8, height: 1.5 };
    const unknown = getModelTemplate({ kind: 'bestaat-niet' as ModelKind }, dims);
    const size = measure(unknown).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1.2, 6);
    expect(size.z).toBeCloseTo(0.8, 6);
    expect(size.y).toBeCloseTo(1.5, 6);
    const none = measure(getModelTemplate(undefined, dims)).getSize(new THREE.Vector3());
    expect(none.y).toBeCloseTo(1.5, 6);
  });

  it('blijft licht: geen model heeft meer dan 150 onderdelen', () => {
    for (const p of PRODUCTS) {
      let meshes = 0;
      getModelTemplate(p.model, p.dimensions).traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes += 1;
      });
      expect(meshes, p.id).toBeGreaterThan(2);
      expect(meshes, p.id).toBeLessThan(150);
    }
  });
});
