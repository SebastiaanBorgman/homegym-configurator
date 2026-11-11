import type * as THREE from 'three';
import type { ModelSpec } from '../catalog/types';
import type { Dimensions } from '../domain/types';
import { BUILDERS } from './builders';
import { Kit, finalize, type ModelFit } from './kit';

export { measure } from './kit';
export type { ModelFit } from './kit';

const cache = new Map<string, THREE.Group>();

const FALLBACK: ModelSpec = { kind: 'box' };

/**
 * Bouwt (of haalt uit de cache) het sjabloonmodel voor een product op de gegeven buitenmaten.
 * Mislukt het bouwen van een model, dan valt het terug op een neutraal blok op ware grootte,
 * zodat één kapot model nooit de hele configurator onbruikbaar maakt.
 */
export function getModelTemplate(spec: ModelSpec | undefined, dims: Dimensions): THREE.Group {
  const model = spec ?? FALLBACK;
  const key = `${model.kind}|${JSON.stringify(model.params ?? {})}|${dims.width}|${dims.depth}|${dims.height}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let group: THREE.Group;
  try {
    const kit = new Kit(dims.width, dims.depth, dims.height);
    (BUILDERS[model.kind] ?? BUILDERS.box)(kit, model.params ?? {});
    group = finalize(kit);
    if (!group.children[0]?.children.length) throw new Error('leeg model');
  } catch (error) {
    console.warn(`3D-model "${model.kind}" kon niet worden opgebouwd; er wordt een blok getoond.`, error);
    const kit = new Kit(dims.width, dims.depth, dims.height);
    BUILDERS.box(kit, {});
    group = finalize(kit);
  }
  cache.set(key, group);
  return group;
}

/** Een eigen exemplaar voor in de scène; geometrie en materialen worden gedeeld met het sjabloon. */
export function createModelInstance(spec: ModelSpec | undefined, dims: Dimensions): THREE.Group {
  return getModelTemplate(spec, dims).clone(true);
}

export function modelFit(group: THREE.Object3D): ModelFit | undefined {
  return group.userData.fit as ModelFit | undefined;
}
