import { DoorOpen, Info, Plus, RectangleVertical, Trash2, AppWindow } from 'lucide-react';
import { FLOOR_OPTIONS, ROOM_PRESETS, WALL_COLORS } from '../domain/defaults';
import { wallLength } from '../domain/geometry/shapes';
import { ROOM_LIMITS, WALL_LABELS, type Obstacle, type Opening, type WallId } from '../domain/types';
import { classNames, formatArea } from '../lib/format';
import { useDesignStore } from '../state/designStore';
import { Button, IconButton, NumberField, SectionTitle, Segmented } from '../ui/primitives';

const WALL_OPTIONS: WallId[] = ['north', 'east', 'south', 'west'];

function OpeningRow({ opening }: { opening: Opening }) {
  const room = useDesignStore((s) => s.design.room);
  const selected = useDesignStore((s) => s.selection?.id === opening.id);
  const { updateOpening, removeOpening, select } = useDesignStore.getState();
  const isDoor = opening.kind === 'door';
  const maxOffset = Math.max(0.05, wallLength(room, opening.wall) - opening.width - 0.05);
  return (
    <li
      className={classNames('rounded-2xl border bg-white p-3 transition', selected ? 'border-info ring-2 ring-info/15' : 'border-sand-200')}
      onPointerDown={() => select({ kind: 'opening', id: opening.id })}
      data-testid={`opening-${opening.kind}`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          {isDoor ? <DoorOpen size={15} /> : <AppWindow size={15} />}
          {isDoor ? 'Deur' : 'Raam'}
        </span>
        <IconButton label={`${isDoor ? 'Deur' : 'Raam'} verwijderen`} tone="danger" size="sm" onClick={() => removeOpening(opening.id)}>
          <Trash2 size={15} />
        </IconButton>
      </div>
      <label className="mb-2 block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">Muur</span>
        <select
          value={opening.wall}
          onChange={(e) => updateOpening(opening.id, { wall: e.target.value as WallId })}
          className="h-9 w-full rounded-lg border border-sand-300 bg-white px-2 text-sm font-medium text-ink-900 outline-none hover:border-ink-300 focus:border-ink-900"
        >
          {WALL_OPTIONS.map((w) => (
            <option key={w} value={w}>
              {WALL_LABELS[w]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Vanaf hoek" unit="cm" scale={100} decimals={0} step={0.05} min={0.05} max={maxOffset} value={opening.offset} onCommit={(v) => updateOpening(opening.id, { offset: v })} />
        <NumberField label="Breedte" unit="cm" scale={100} decimals={0} step={0.05} min={0.4} max={6} value={opening.width} onCommit={(v) => updateOpening(opening.id, { width: v })} />
        <NumberField label="Hoogte" unit="cm" scale={100} decimals={0} step={0.05} min={0.3} max={room.height} value={opening.height} onCommit={(v) => updateOpening(opening.id, { height: v })} />
        {isDoor ? (
          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">Draait</span>
            <Segmented
              ariaLabel="Draairichting van de deur"
              size="sm"
              className="w-full"
              value={opening.swing}
              onChange={(v) => updateOpening(opening.id, { swing: v })}
              options={[
                { value: 'in', label: 'Naar binnen' },
                { value: 'out', label: 'Naar buiten' },
              ]}
            />
          </div>
        ) : (
          <NumberField label="Borsthoogte" unit="cm" scale={100} decimals={0} step={0.05} min={0} max={room.height - 0.4} value={opening.sill} onCommit={(v) => updateOpening(opening.id, { sill: v })} />
        )}
      </div>
    </li>
  );
}

function ObstacleRow({ obstacle }: { obstacle: Obstacle }) {
  const room = useDesignStore((s) => s.design.room);
  const selected = useDesignStore((s) => s.selection?.id === obstacle.id);
  const { updateObstacle, removeObstacle, select } = useDesignStore.getState();
  return (
    <li
      className={classNames('rounded-2xl border bg-white p-3 transition', selected ? 'border-info ring-2 ring-info/15' : 'border-sand-200')}
      onPointerDown={() => select({ kind: 'obstacle', id: obstacle.id })}
      data-testid="obstacle-row"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <input
          value={obstacle.name}
          onChange={(e) => updateObstacle(obstacle.id, { name: e.target.value.slice(0, 40) }, false)}
          aria-label="Naam van het obstakel"
          className="min-w-0 flex-1 rounded-md bg-transparent text-[13px] font-semibold text-ink-900 outline-none focus:bg-sand-100"
        />
        <IconButton label="Obstakel verwijderen" tone="danger" size="sm" onClick={() => removeObstacle(obstacle.id)}>
          <Trash2 size={15} />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Breedte" unit="cm" scale={100} decimals={0} step={0.05} min={0.05} max={10} value={obstacle.width} onCommit={(v) => updateObstacle(obstacle.id, { width: v })} />
        <NumberField label="Diepte" unit="cm" scale={100} decimals={0} step={0.05} min={0.05} max={10} value={obstacle.depth} onCommit={(v) => updateObstacle(obstacle.id, { depth: v })} />
        <NumberField label="Hoogte" unit="cm" scale={100} decimals={0} step={0.05} min={0.05} max={room.height} value={obstacle.height} onCommit={(v) => updateObstacle(obstacle.id, { height: v })} />
        <NumberField label="X" unit="cm" scale={100} decimals={0} step={0.05} value={obstacle.x} onCommit={(v) => updateObstacle(obstacle.id, { x: v })} />
        <NumberField label="Z" unit="cm" scale={100} decimals={0} step={0.05} value={obstacle.z} onCommit={(v) => updateObstacle(obstacle.id, { z: v })} />
        <NumberField label="Draaiing" unit="°" decimals={0} step={15} min={-360} max={360} value={obstacle.rotationDeg} onCommit={(v) => updateObstacle(obstacle.id, { rotationDeg: ((v % 360) + 360) % 360 })} />
      </div>
    </li>
  );
}

export function RoomPanel() {
  const room = useDesignStore((s) => s.design.room);
  const openings = useDesignStore((s) => s.design.openings);
  const obstacles = useDesignStore((s) => s.design.obstacles);
  const { setRoom, applyPreset, addOpening, addObstacle } = useDesignStore.getState();

  return (
    <div className="scroll-thin h-full space-y-6 overflow-y-auto px-4 py-4">
      <section>
        <SectionTitle>Afmetingen</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <NumberField testId="room-width" label="Breedte" unit="m" step={0.1} min={ROOM_LIMITS.width.min} max={ROOM_LIMITS.width.max} value={room.width} onCommit={(v) => setRoom({ width: v })} />
          <NumberField testId="room-length" label="Lengte" unit="m" step={0.1} min={ROOM_LIMITS.length.min} max={ROOM_LIMITS.length.max} value={room.length} onCommit={(v) => setRoom({ length: v })} />
          <NumberField testId="room-height" label="Hoogte" unit="m" step={0.05} min={ROOM_LIMITS.height.min} max={ROOM_LIMITS.height.max} value={room.height} onCommit={(v) => setRoom({ height: v })} />
        </div>
        <p className="mt-2 text-xs text-ink-400">
          Vloeroppervlak <span className="tabular font-semibold text-ink-600">{formatArea(room.width * room.length)}</span> · binnenmaten, in
          meters.
        </p>
      </section>

      <section>
        <SectionTitle>Begin met een type ruimte</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {ROOM_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              data-testid={`preset-${p.id}`}
              className="rounded-xl border border-sand-300 bg-white px-3 py-2 text-left transition hover:border-ink-900"
            >
              <span className="block text-[13px] font-semibold text-ink-900">{p.label}</span>
              <span className="tabular block text-xs text-ink-400">
                {p.hint} · {p.room.height.toLocaleString('nl-NL')} m hoog
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-ink-400">
          <Info size={13} className="mt-0.5 shrink-0" />
          Een type vervangt afmetingen, deuren en ramen; je apparaten blijven staan. Schuine daken worden nog niet ondersteund: vul bij een
          zolder de laagste bruikbare hoogte in.
        </p>
      </section>

      <section>
        <SectionTitle>Afwerking</SectionTitle>
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-500">Vloer</span>
            <div className="grid grid-cols-4 gap-2">
              {FLOOR_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={room.floor === f.value}
                  onClick={() => setRoom({ floor: f.value })}
                  className={classNames(
                    'rounded-xl border p-1.5 text-center transition',
                    room.floor === f.value ? 'border-ink-900 ring-2 ring-ink-900/10' : 'border-sand-300 hover:border-ink-400',
                  )}
                >
                  <span className="mb-1 block h-7 rounded-lg" style={{ background: f.swatch }} />
                  <span className="block text-[11px] font-semibold text-ink-700">{f.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-500">Wandkleur</span>
            <div className="flex flex-wrap gap-2">
              {WALL_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={`Wandkleur ${c.label}`}
                  aria-pressed={room.wallColor === c.value}
                  onClick={() => setRoom({ wallColor: c.value })}
                  className={classNames(
                    'size-8 rounded-full border transition',
                    room.wallColor === c.value ? 'border-ink-900 ring-2 ring-ink-900/20 ring-offset-2' : 'border-sand-300 hover:scale-105',
                  )}
                  style={{ background: c.value }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <span className="flex gap-1.5">
              <Button size="sm" icon={<Plus size={14} />} onClick={() => addOpening('door')} data-testid="add-door">
                Deur
              </Button>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => addOpening('window')} data-testid="add-window">
                Raam
              </Button>
            </span>
          }
        >
          Deuren en ramen
        </SectionTitle>
        {openings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sand-300 px-3 py-4 text-center text-xs text-ink-400">Nog geen deuren of ramen.</p>
        ) : (
          <ul className="space-y-2">
            {openings.map((o) => (
              <OpeningRow key={o.id} opening={o} />
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs leading-relaxed text-ink-400">Het draaibereik van een deur wordt vrijgehouden in de ruimtecontrole.</p>
      </section>

      <section>
        <SectionTitle
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => addObstacle()} data-testid="add-obstacle">
              Pilaar
            </Button>
          }
        >
          Obstakels
        </SectionTitle>
        {obstacles.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-sand-300 px-3 py-4 text-center text-xs text-ink-400">
            <RectangleVertical size={14} /> Pilaren, cv-ketel of een kast: voeg ze toe als blok.
          </p>
        ) : (
          <ul className="space-y-2">
            {obstacles.map((o) => (
              <ObstacleRow key={o.id} obstacle={o} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
