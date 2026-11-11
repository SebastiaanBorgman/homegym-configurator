import {
  ArrowDown,
  CircleAlert,
  CircleCheck,
  Copy,
  Eye,
  Info,
  Minus,
  PersonStanding,
  Plus,
  RotateCcw,
  RotateCw,
  Rotate3d,
  SlidersHorizontal,
  Square,
  Trash2,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatArea, classNames, meters } from '../lib/format';
import { useDerived } from '../state/derived';
import { useDesignStore } from '../state/designStore';
import { useUiStore, type CameraPreset, type WallMode } from '../state/uiStore';
import { Button, IconButton, Segmented, Switch } from '../ui/primitives';

const floatClass = 'rounded-2xl border border-white/60 bg-white/90 shadow-float backdrop-blur-md';

function StatusChip({ onOpenChecks }: { onOpenChecks: () => void }) {
  const room = useDesignStore((s) => s.design.room);
  const itemCount = useDesignStore((s) => s.design.items.length);
  const { summary } = useDerived();
  const tone = summary.errors ? 'text-danger' : summary.warnings ? 'text-[#9a6200]' : 'text-ok';
  return (
    <div className={classNames(floatClass, 'flex items-stretch divide-x divide-sand-200 text-xs')}>
      <div className="px-3 py-2">
        <span className="tabular block font-bold text-ink-900" data-testid="room-chip">
          {meters(room.width)} × {meters(room.length)}
        </span>
        <span className="tabular block text-ink-400">
          {formatArea(room.width * room.length)} · {meters(room.height)} hoog
        </span>
      </div>
      <button type="button" onClick={onOpenChecks} className="flex items-center gap-2 rounded-r-2xl px-3 py-2 text-left transition hover:bg-sand-100" data-testid="status-chip">
        <span className={tone}>{summary.errors ? <CircleAlert size={18} /> : summary.warnings ? <TriangleAlert size={18} /> : <CircleCheck size={18} />}</span>
        <span>
          <span className="block font-bold text-ink-900">
            {itemCount === 0 ? 'Lege ruimte' : summary.errors ? `${summary.errors} past niet` : summary.warnings ? `${summary.warnings} aandachtspunt${summary.warnings > 1 ? 'en' : ''}` : 'Alles past'}
          </span>
          <span className="block text-ink-400">Ruimtecontrole</span>
        </span>
      </button>
    </div>
  );
}

function ViewOptions() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const ui = useUiStore();
  const is3d = ui.viewMode === '3d';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="view-options"
        className={classNames(floatClass, 'flex h-11 items-center gap-2 px-3.5 text-[13px] font-semibold text-ink-800 transition hover:bg-white')}
      >
        <SlidersHorizontal size={16} />
        <span className="hidden sm:inline">Weergave</span>
      </button>
      {open && (
        <div className={classNames(floatClass, 'absolute right-0 top-13 z-20 w-72 animate-pop bg-white p-4')} role="dialog" aria-label="Weergave-instellingen">
          {is3d && (
            <div className="mb-3">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-400">Muren</span>
              <Segmented<WallMode>
                ariaLabel="Weergave van de muren"
                className="w-full"
                value={ui.wallMode}
                onChange={(v) => ui.setPreference('wallMode', v)}
                options={[
                  { value: 'auto', label: 'Slim', title: 'Muren die het zicht blokkeren verdwijnen vanzelf' },
                  { value: 'vol', label: 'Alle', title: 'Alle muren tonen' },
                  { value: 'verborgen', label: 'Geen', title: 'Alle muren verbergen' },
                ]}
              />
              <p className="mt-1.5 text-xs text-ink-400">Slim: de muren tussen jou en de ruimte verdwijnen vanzelf.</p>
            </div>
          )}
          <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wider text-ink-400">Magnetisch uitlijnen</span>
          <Switch label="Op muren" checked={ui.snapWalls} onChange={(v) => ui.setPreference('snapWalls', v)} />
          <Switch label="Op andere apparaten" checked={ui.snapObjects} onChange={(v) => ui.setPreference('snapObjects', v)} />
          <Switch label="Op raster" hint={`Stappen van ${Math.round(ui.gridSize * 100)} cm`} checked={ui.snapGrid} onChange={(v) => ui.setPreference('snapGrid', v)} />
          {ui.snapGrid && (
            <Segmented
              ariaLabel="Rastermaat"
              size="sm"
              className="mb-1 w-full"
              value={String(ui.gridSize)}
              onChange={(v) => ui.setPreference('gridSize', Number(v))}
              options={[
                { value: '0.1', label: '10 cm' },
                { value: '0.25', label: '25 cm' },
                { value: '0.5', label: '50 cm' },
              ]}
            />
          )}
          <p className="mb-3 text-xs text-ink-400">Houd Alt ingedrukt tijdens het slepen om tijdelijk vrij te plaatsen.</p>
          <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wider text-ink-400">Tonen</span>
          <Switch label="Gebruiksruimte van alle apparaten" checked={ui.showAllZones} onChange={(v) => ui.setPreference('showAllZones', v)} />
          <Switch label="Maten en labels" checked={ui.showLabels} onChange={(v) => ui.setPreference('showLabels', v)} />
        </div>
      )}
    </div>
  );
}

function SelectionToolbar() {
  const item = useDesignStore((s) => (s.selection?.kind === 'item' ? s.design.items.find((i) => i.id === s.selection!.id) : undefined));
  if (!item) return null;
  const store = useDesignStore.getState();
  return (
    <div className={classNames(floatClass, 'flex max-w-full animate-pop items-center gap-0.5 p-1')} data-testid="selection-toolbar" role="toolbar" aria-label="Geselecteerd apparaat">
      <span className="hidden max-w-44 truncate px-2.5 text-[13px] font-semibold text-ink-900 md:block">{item.label}</span>
      <span className="mx-1 hidden h-5 w-px bg-sand-300 md:block" />
      <IconButton label="Draai 90° tegen de klok in (Shift+R)" onClick={() => store.rotateItem(item.id, 90)} data-testid="tb-rotate-ccw">
        <RotateCcw size={17} />
      </IconButton>
      <IconButton label="Draai 90° met de klok mee (R)" onClick={() => store.rotateItem(item.id, -90)} data-testid="tb-rotate-cw">
        <RotateCw size={17} />
      </IconButton>
      <IconButton label="Zet met de rug tegen de dichtstbijzijnde muur (W)" onClick={() => store.moveItemToWall(item.id)} data-testid="tb-wall">
        <ArrowDown size={17} className="rotate-180" />
        <span className="sr-only">Tegen muur</span>
      </IconButton>
      <IconButton label="Dupliceren (Ctrl+D)" onClick={() => store.duplicateItem(item.id)} data-testid="tb-duplicate">
        <Copy size={17} />
      </IconButton>
      <IconButton label="Productinformatie" onClick={() => useUiStore.getState().openProduct(item.productId)}>
        <Info size={17} />
      </IconButton>
      <span className="mx-1 h-5 w-px bg-sand-300" />
      <IconButton label="Verwijderen (Delete)" tone="danger" onClick={() => store.removeItem(item.id)} data-testid="tb-delete">
        <Trash2 size={17} />
      </IconButton>
    </div>
  );
}

const CAMERA_BUTTONS: { preset: CameraPreset; label: string; title: string; icon: ReactNode }[] = [
  { preset: 'standaard', label: 'Standaard', title: 'Terug naar het standaardaanzicht (Home)', icon: <Rotate3d size={16} /> },
  { preset: 'boven', label: 'Boven', title: 'Van bovenaf bekijken', icon: <Square size={15} /> },
  { preset: 'laag', label: 'Laag', title: 'Vanuit een laag standpunt', icon: <Eye size={16} /> },
  { preset: 'binnen', label: 'Binnen', title: 'Op ooghoogte in de ruimte staan', icon: <PersonStanding size={16} /> },
];

function CameraToolbar() {
  const send = useUiStore((s) => s.sendCamera);
  return (
    <div className={classNames(floatClass, 'flex items-center gap-0.5 p-1')} role="toolbar" aria-label="Camera" data-testid="camera-toolbar">
      {CAMERA_BUTTONS.map((b) => (
        <button
          key={b.preset}
          type="button"
          title={b.title}
          onClick={() => send(b.preset)}
          data-testid={`camera-${b.preset}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold text-ink-700 transition hover:bg-ink-900/[0.07] hover:text-ink-900"
        >
          {b.icon}
          <span className="hidden sm:inline">{b.label}</span>
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-sand-300" />
      <IconButton label="Uitzoomen" onClick={() => send('zoom-uit')} data-testid="camera-zoom-out">
        <Minus size={17} />
      </IconButton>
      <IconButton label="Inzoomen" onClick={() => send('zoom-in')} data-testid="camera-zoom-in">
        <Plus size={17} />
      </IconButton>
    </div>
  );
}

function EmptyHint({ onOpenCatalog, onOpenLayout }: { onOpenCatalog: () => void; onOpenLayout: () => void }) {
  return (
    <div className={classNames(floatClass, 'pointer-events-auto mx-auto w-full max-w-md animate-rise p-4 text-center')} data-testid="empty-hint">
      <p className="text-sm font-bold text-ink-900">Dit is je lege ruimte</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-500">Voeg apparatuur toe uit de catalogus, of laat een eerste indeling voorstellen.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button variant="dark" size="sm" icon={<Plus size={15} />} onClick={onOpenCatalog}>
          Apparatuur toevoegen
        </Button>
        <Button size="sm" icon={<WandSparkles size={15} />} onClick={onOpenLayout}>
          Genereer een indeling
        </Button>
      </div>
    </div>
  );
}

interface OverlayProps {
  onOpenChecks: () => void;
  onOpenCatalog: () => void;
  onOpenLayout: () => void;
}

/** Zwevende bediening over de 3D- of 2D-weergave. */
export function ViewportOverlay({ onOpenChecks, onOpenCatalog, onOpenLayout }: OverlayProps) {
  const viewMode = useUiStore((s) => s.viewMode);
  const dragging = useUiStore((s) => s.dragging);
  const empty = useDesignStore((s) => s.design.items.length === 0);
  const hasSelection = useDesignStore((s) => s.selection?.kind === 'item');

  return (
    <div className={classNames('pointer-events-none absolute inset-0 z-40 flex flex-col justify-between p-3 transition-opacity', dragging && 'opacity-40')}>
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto">
          <StatusChip onOpenChecks={onOpenChecks} />
        </div>
        <div className="pointer-events-auto">
          <ViewOptions />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        {empty && !hasSelection && <EmptyHint onOpenCatalog={onOpenCatalog} onOpenLayout={onOpenLayout} />}
        <div className="pointer-events-auto max-w-full">
          <SelectionToolbar />
        </div>
        {viewMode === '3d' && (
          <div className="pointer-events-auto">
            <CameraToolbar />
          </div>
        )}
        <p className="hidden text-center text-[11px] font-medium text-ink-500 lg:block">
          {viewMode === '3d'
            ? 'Slepen: draaien · Rechtermuisknop of Shift + slepen: schuiven · Scrollen: zoomen · Sleep een apparaat om het te verplaatsen'
            : 'Sleep een apparaat om het te verplaatsen · R draait 90° · de pijl geeft de voorzijde aan'}
        </p>
      </div>
    </div>
  );
}
