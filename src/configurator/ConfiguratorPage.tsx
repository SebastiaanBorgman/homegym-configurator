import { Dumbbell, LayoutGrid, ListChecks, Ruler, ShoppingCart, X } from 'lucide-react';
import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { BRAND } from '../config/brand';
import { classNames } from '../lib/format';
import { SceneLabelLayer } from '../scene/labels';
import { installDebugApi } from '../state/debugApi';
import { useDerived } from '../state/derived';
import { useDesignStore } from '../state/designStore';
import { toast, useUiStore, type PanelTab } from '../state/uiStore';
import { Button, Toasts, useMediaQuery } from '../ui/primitives';
import { ProductDialog } from '../ui/product';
import { CatalogPanel } from './CatalogPanel';
import { ChecksPanel, Inspector, LayoutPanel, OrderPanel } from './panels';
import { PlanView } from './PlanView';
import { RoomPanel } from './RoomPanel';
import { TopBar } from './TopBar';
import { ViewportOverlay } from './ViewportOverlay';

const GymScene = lazy(() => import('../scene/GymScene'));

// ───────────────────────────────────── 3D-weergave ─────────────────────────────────────

function SceneFallback({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6" data-testid="scene-fallback">
      <div className="max-w-sm rounded-3xl bg-white p-6 text-center shadow-float">
        <p className="text-sm font-bold text-ink-900">{title}</p>
        <div className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{children}</div>
        <Button variant="dark" size="sm" className="mt-4" onClick={() => useUiStore.getState().setViewMode('2d')}>
          Verder in de 2D-plattegrond
        </Button>
      </div>
    </div>
  );
}

/** Vangt fouten in de 3D-weergave af, zodat de rest van de configurator bruikbaar blijft. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('De 3D-weergave is gestopt door een fout:', error);
  }
  render() {
    if (this.state.failed) {
      return (
        <SceneFallback title="De 3D-weergave kon niet worden gestart">
          Je ontwerp is veilig bewaard. Ververs de pagina om het opnieuw te proberen, of werk verder in het bovenaanzicht.
        </SceneFallback>
      );
    }
    return this.props.children;
  }
}

function SceneLoading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" role="status">
      <span className="size-9 animate-spin rounded-full border-[3px] border-ink-900/15 border-t-ink-900" />
      <span className="text-[13px] font-medium text-ink-500">3D-ruimte wordt opgebouwd…</span>
    </div>
  );
}

/** Controleert of de browser WebGL kan starten; zo niet, dan tonen we een nette melding. */
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function Viewport() {
  const design = useDesignStore((s) => s.design);
  const viewMode = useUiStore((s) => s.viewMode);
  const is3d = viewMode === '3d';
  const [webgl] = useState(isWebGLAvailable);
  // De 3D-weergave blijft na het eerste gebruik gemonteerd: bij terugkeer uit de plattegrond
  // staat de camera nog waar je was. Buiten beeld wordt er niet getekend.
  const [sceneMounted, setSceneMounted] = useState(is3d);
  useEffect(() => {
    if (is3d) setSceneMounted(true);
  }, [is3d]);

  return (
    <>
      {!is3d && (
        <div className="absolute inset-0 px-2 pb-24 pt-16 sm:px-4">
          <PlanView />
        </div>
      )}
      {is3d && !webgl && (
        <SceneFallback title="3D wordt niet ondersteund in deze browser">
          Deze browser of dit apparaat kan geen WebGL starten. De plattegrond in 2D werkt wel en gebruikt dezelfde gegevens.
        </SceneFallback>
      )}
      {webgl && sceneMounted && (
        <SceneBoundary>
          <Suspense fallback={<SceneLoading />}>
            <div className={classNames('absolute inset-0', !is3d && 'invisible')} data-testid="scene-3d" aria-hidden={!is3d}>
              <GymScene design={design} paused={!is3d} />
              {is3d && <SceneLabelLayer />}
            </div>
          </Suspense>
        </SceneBoundary>
      )}
    </>
  );
}

// ───────────────────────────────────── Panelen ─────────────────────────────────────

interface TabDef {
  id: PanelTab;
  label: string;
  /** Korte naam voor als er vijf tabbladen naast elkaar staan. */
  short: string;
  icon: ReactNode;
}

const TABS: Record<PanelTab, TabDef> = {
  catalogus: { id: 'catalogus', label: 'Catalogus', short: 'Catalogus', icon: <Dumbbell size={16} /> },
  ruimte: { id: 'ruimte', label: 'Ruimte', short: 'Ruimte', icon: <Ruler size={16} /> },
  indeling: { id: 'indeling', label: 'Indeling', short: 'Indeling', icon: <LayoutGrid size={16} /> },
  controle: { id: 'controle', label: 'Controle', short: 'Controle', icon: <ListChecks size={16} /> },
  bestellijst: { id: 'bestellijst', label: 'Bestellijst', short: 'Lijst', icon: <ShoppingCart size={16} /> },
};

function TabBadge({ tab }: { tab: PanelTab }) {
  const { summary, order } = useDerived();
  const placed = useDesignStore((s) => s.design.items.length);
  if (tab === 'controle' && (summary.errors || summary.warnings)) {
    return (
      <span className={classNames('tabular inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white', summary.errors ? 'bg-danger' : 'bg-warn')}>
        {summary.errors || summary.warnings}
      </span>
    );
  }
  if (tab === 'bestellijst' && order.itemCount > 0) {
    return <span className="tabular inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-900 px-1 text-[10px] font-bold text-white">{order.itemCount}</span>;
  }
  if (tab === 'indeling' && placed > 0) {
    return <span className="tabular inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sand-300 px-1 text-[10px] font-bold text-ink-700">{placed}</span>;
  }
  return null;
}

function PanelContent({ tab, withInspector }: { tab: PanelTab; withInspector: boolean }) {
  switch (tab) {
    case 'catalogus':
      return <CatalogPanel />;
    case 'ruimte':
      return <RoomPanel />;
    case 'indeling':
      return <LayoutPanel withInspector={withInspector} />;
    case 'controle':
      return <ChecksPanel />;
    case 'bestellijst':
      return <OrderPanel />;
  }
}

function TabbedPanel({ tabs, active, onChange, withInspector }: { tabs: PanelTab[]; active: PanelTab; onChange: (tab: PanelTab) => void; withInspector: boolean }) {
  const current = tabs.includes(active) ? active : tabs[0];
  const compact = tabs.length > 3;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-sand-200 bg-white px-1.5" role="tablist">
        {tabs.map((id) => {
          const tab = TABS[id];
          const selected = id === current;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`tab-${id}`}
              onClick={() => onChange(id)}
              className={classNames(
                'relative flex h-12 items-center justify-center font-semibold transition',
                compact ? 'shrink-0 grow gap-1 px-1.5 text-xs' : 'flex-1 gap-1.5 px-1 text-[13px]',
                selected ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700',
              )}
            >
              {!compact && tab.icon}
              <span>{compact ? tab.short : tab.label}</span>
              <TabBadge tab={id} />
              {selected && <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-ink-900" />}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 bg-sand-50" role="tabpanel" data-testid={`panel-${current}`}>
        <PanelContent tab={current} withInspector={withInspector} />
      </div>
    </div>
  );
}

function MobileNav() {
  const sheet = useUiStore((s) => s.mobileSheet);
  const setSheet = useUiStore((s) => s.setMobileSheet);
  const order: PanelTab[] = ['catalogus', 'ruimte', 'indeling', 'controle', 'bestellijst'];
  return (
    <>
      {sheet && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="presentation">
          <div className="absolute inset-0 animate-fade bg-ink-950/45" onClick={() => setSheet(null)} />
          <div className="relative flex h-[72dvh] animate-sheet flex-col overflow-hidden rounded-t-3xl bg-sand-50 shadow-pop" role="dialog" aria-label={TABS[sheet].label} data-testid="mobile-sheet">
            <div className="flex shrink-0 items-center justify-between border-b border-sand-200 bg-white px-4 py-3">
              <h2 className="display text-base text-ink-900">{TABS[sheet].label}</h2>
              <button type="button" aria-label="Paneel sluiten" onClick={() => setSheet(null)} className="inline-flex size-9 items-center justify-center rounded-full bg-sand-100 text-ink-600">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <PanelContent tab={sheet} withInspector />
            </div>
          </div>
        </div>
      )}
      <nav className="relative z-50 flex shrink-0 border-t border-sand-200 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Onderdelen van de configurator">
        {order.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSheet(sheet === id ? null : id)}
            data-testid={`nav-${id}`}
            className={classNames('relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold', sheet === id ? 'text-ink-900' : 'text-ink-400')}
          >
            <span className="relative">
              {TABS[id].icon}
              <span className="absolute -right-3 -top-1.5">
                <TabBadge tab={id} />
              </span>
            </span>
            {TABS[id].label}
          </button>
        ))}
      </nav>
    </>
  );
}

// ───────────────────────────────────── Sneltoetsen ─────────────────────────────────────

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (useUiStore.getState().productDialogId) return;
      const store = useDesignStore.getState();
      const sel = store.selection;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.key === 'Home') {
        useUiStore.getState().sendCamera('standaard');
        return;
      }
      if (!sel) return;

      if (e.key === 'Escape') {
        store.select(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (sel.kind === 'item') store.removeItem(sel.id);
        else if (sel.kind === 'obstacle') store.removeObstacle(sel.id);
        else store.removeOpening(sel.id);
        return;
      }
      if (sel.kind !== 'item') return;
      const item = store.design.items.find((i) => i.id === sel.id);
      if (!item) return;

      if (mod && key === 'd') {
        e.preventDefault();
        store.duplicateItem(item.id);
      } else if (!mod && key === 'r') {
        store.rotateItem(item.id, e.shiftKey ? 90 : -90);
      } else if (!mod && key === 'q') {
        store.rotateItem(item.id, 15);
      } else if (!mod && key === 'e') {
        store.rotateItem(item.id, -15);
      } else if (!mod && key === 'w') {
        store.moveItemToWall(item.id);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 0.1 : 0.01;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dz = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        store.updateItem(item.id, { x: Math.round((item.x + dx) * 1000) / 1000, z: Math.round((item.z + dz) * 1000) / 1000 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ───────────────────────────────────── Pagina ─────────────────────────────────────

export default function ConfiguratorPage() {
  const wide = useMediaQuery('(min-width: 1280px)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const leftTab = useUiStore((s) => s.leftTab);
  const rightTab = useUiStore((s) => s.rightTab);
  const hasSelection = useDesignStore((s) => s.selection?.kind === 'item');
  const ui = useUiStore.getState();

  useShortcuts();

  useEffect(() => {
    document.title = `Configurator — ${BRAND.name}`;
    installDebugApi();
    const { loadWarnings } = useDesignStore.getState();
    if (loadWarnings.length) {
      toast('info', 'Je bewaarde ontwerp is bijgewerkt', loadWarnings.slice(0, 2).join(' '));
      useDesignStore.setState({ loadWarnings: [] });
    }
  }, []);

  const openTab = (tab: PanelTab) => {
    if (wide && (tab === 'controle' || tab === 'bestellijst')) ui.setRightTab(tab);
    else if (desktop) ui.setLeftTab(tab);
    else ui.setMobileSheet(tab);
  };

  // Op een smal scherm: bij selecteren schuift het paneel niet vanzelf open; de werkbalk volstaat.
  const leftTabs: PanelTab[] = wide ? ['catalogus', 'ruimte', 'indeling'] : ['catalogus', 'ruimte', 'indeling', 'controle', 'bestellijst'];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-sand-100" data-testid="configurator">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {desktop && (
          <aside className="flex w-[350px] shrink-0 flex-col border-r border-sand-200 bg-white" aria-label="Catalogus en ruimte">
            <TabbedPanel tabs={leftTabs} active={leftTab} onChange={ui.setLeftTab} withInspector={!wide} />
          </aside>
        )}
        <main className="viewport-backdrop relative min-w-0 flex-1 overflow-hidden">
          <Viewport />
          <ViewportOverlay onOpenChecks={() => openTab('controle')} onOpenCatalog={() => openTab('catalogus')} onOpenLayout={() => openTab('indeling')} />
        </main>
        {wide && (
          <aside className="flex w-[350px] shrink-0 flex-col border-l border-sand-200 bg-white" aria-label="Controle en bestellijst">
            {hasSelection && (
              <div className="scroll-thin max-h-[58%] shrink-0 overflow-y-auto">
                <Inspector />
              </div>
            )}
            <div className="min-h-0 flex-1">
              <TabbedPanel tabs={['controle', 'bestellijst']} active={rightTab} onChange={(t) => ui.setRightTab(t as 'controle' | 'bestellijst')} withInspector={false} />
            </div>
          </aside>
        )}
      </div>
      {!desktop && <MobileNav />}
      <ProductDialog />
      <Toasts />
    </div>
  );
}
