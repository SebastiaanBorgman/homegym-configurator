import { useEffect, useRef, type ReactNode } from 'react';
import { classNames, formatDims, meters } from '../lib/format';
import { useDesignStore } from '../state/designStore';
import { useUiStore } from '../state/uiStore';

/**
 * Tekstlabels bij de 3D-weergave.
 *
 * De labels zijn gewone HTML-elementen in een laag óver het canvas. De scène projecteert bij
 * elk getekend beeld hun positie in de ruimte naar het scherm (zie LabelProjector in GymScene).
 * Zo blijven de teksten haarscherp en hoeft er geen tweede React-boom in het canvas te leven.
 */

export interface LabelAnchor {
  el: HTMLElement;
  /** Positie in de ruimte (meters). */
  position: [number, number, number];
}

export const labelAnchors = new Set<LabelAnchor>();

/** Wordt door de scène gevuld; vraagt om een nieuw beeld zodat labels direct goed staan. */
export const labelBus = { invalidate: () => {} };

function SceneLabel({ x, y, z, className, children }: { x: number; y: number; z: number; className?: string; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const anchor = useRef<LabelAnchor | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const a: LabelAnchor = { el: el.current, position: [x, y, z] };
    anchor.current = a;
    labelAnchors.add(a);
    labelBus.invalidate();
    return () => {
      labelAnchors.delete(a);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!anchor.current) return;
    anchor.current.position = [x, y, z];
    labelBus.invalidate();
  }, [x, y, z]);

  return (
    <div ref={el} className={classNames('scene-label absolute left-0 top-0 will-change-transform', className)} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

/** Laag met maatlabels van de ruimte en het label van het geselecteerde apparaat. */
export function SceneLabelLayer() {
  const room = useDesignStore((s) => s.design.room);
  const item = useDesignStore((s) => (s.selection?.kind === 'item' ? s.design.items.find((i) => i.id === s.selection!.id) : undefined));
  const showLabels = useUiStore((s) => s.showLabels);
  const dragging = useUiStore((s) => s.dragging);
  if (!showLabels) return null;
  const margin = 0.34;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden data-testid="scene-labels">
      <SceneLabel x={room.width / 2} y={0} z={room.length + margin}>
        {meters(room.width)}
      </SceneLabel>
      <SceneLabel x={room.width + margin} y={0} z={room.length / 2}>
        {meters(room.length)}
      </SceneLabel>
      <SceneLabel x={0} y={room.height / 2} z={0}>
        ↕ {meters(room.height)}
      </SceneLabel>
      {item && !dragging && (
        <SceneLabel key={item.id} x={item.x} y={item.y + item.dimensions.height + 0.32} z={item.z} className="scene-label--item">
          <strong>{item.label}</strong>
          <span>{formatDims(item.dimensions)}</span>
        </SceneLabel>
      )}
    </div>
  );
}
