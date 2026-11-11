import { Box, Check, CloudOff, Download, Ellipsis, FilePlus2, Image, Map, Redo2, ShoppingCart, Undo2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { formatEuroCompact, formatEuroRounded } from '../domain/pricing';
import { classNames } from '../lib/format';
import { useDerived } from '../state/derived';
import { useDesignStore } from '../state/designStore';
import { useUiStore, type ViewMode } from '../state/uiStore';
import { IconButton, Segmented } from '../ui/primitives';
import { Logo } from '../ui/Logo';
import { exportImage, exportJson, importJsonFile, startNewDesign } from './actions';

function Menu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const items = [
    { label: 'Nieuw ontwerp', hint: 'Begin met een lege ruimte', icon: <FilePlus2 size={16} />, run: startNewDesign, testId: 'menu-new' },
    { label: 'Ontwerp importeren', hint: 'Open een JSON-bestand', icon: <Upload size={16} />, run: () => file.current?.click(), testId: 'menu-import' },
    { label: 'Ontwerp exporteren', hint: 'Bewaar als JSON-bestand', icon: <Download size={16} />, run: exportJson, testId: 'menu-export' },
    { label: 'Afbeelding opslaan', hint: 'PNG van het huidige beeld', icon: <Image size={16} />, run: () => void exportImage(), testId: 'menu-image' },
  ];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="menu-button"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-ink-100 transition hover:bg-white/10"
      >
        <Ellipsis size={18} />
        <span className="hidden md:inline">Ontwerp</span>
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="import-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importJsonFile(f);
          e.target.value = '';
        }}
      />
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 animate-pop rounded-2xl bg-white p-1.5 text-ink-900 shadow-pop">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              data-testid={item.testId}
              onClick={() => {
                setOpen(false);
                item.run();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-sand-100"
            >
              <span className="text-ink-500">{item.icon}</span>
              <span>
                <span className="block text-[13px] font-semibold">{item.label}</span>
                <span className="block text-xs text-ink-400">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const name = useDesignStore((s) => s.design.name);
  const canUndo = useDesignStore((s) => s.past.length > 0);
  const canRedo = useDesignStore((s) => s.future.length > 0);
  const saveFailed = useDesignStore((s) => s.saveFailed);
  const viewMode = useUiStore((s) => s.viewMode);
  const { order } = useDerived();
  const { undo, redo, renameDesign } = useDesignStore.getState();

  return (
    <header className="relative z-50 flex h-14 shrink-0 items-center gap-1 bg-ink-900 px-2 text-white sm:gap-3 sm:px-4">
      <Link to="/" aria-label="Naar de homepage" className="shrink-0 rounded-lg">
        <span className="sm:hidden">
          <Logo tone="dark" compact />
        </span>
        <span className="hidden sm:inline">
          <Logo tone="dark" />
        </span>
      </Link>

      <span className="hidden h-6 w-px bg-white/15 md:block" />
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <input
          value={name}
          onChange={(e) => renameDesign(e.target.value)}
          onBlur={(e) => !e.target.value.trim() && renameDesign('Mijn homegym')}
          aria-label="Naam van het ontwerp"
          data-testid="design-name"
          className="h-8 w-44 min-w-0 rounded-lg bg-transparent px-2 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:bg-white/10 lg:w-56"
        />
        <span
          className={classNames('hidden items-center gap-1 text-xs lg:inline-flex', saveFailed ? 'text-warn' : 'text-ink-300')}
          title={saveFailed ? 'Lokaal opslaan lukt niet (opslag vol of geblokkeerd). Exporteer je ontwerp als JSON.' : 'Je ontwerp wordt automatisch in deze browser bewaard.'}
          data-testid="save-state"
        >
          {saveFailed ? <CloudOff size={13} /> : <Check size={13} />}
          {saveFailed ? 'Niet opgeslagen' : 'Opgeslagen'}
        </span>
      </div>

      <div className="mx-auto">
        <Segmented<ViewMode>
          ariaLabel="Weergave"
          tone="dark"
          size="sm"
          value={viewMode}
          onChange={(v) => useUiStore.getState().setViewMode(v)}
          options={[
            {
              value: '3d',
              label: (
                <span className="inline-flex items-center gap-1.5" data-testid="view-3d">
                  <Box size={14} /> 3D
                </span>
              ),
            },
            {
              value: '2d',
              label: (
                <span className="inline-flex items-center gap-1.5" data-testid="view-2d">
                  <Map size={14} /> 2D
                </span>
              ),
            },
          ]}
        />
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton label="Ongedaan maken (Ctrl+Z)" tone="dark" disabled={!canUndo} onClick={undo} data-testid="undo">
          <Undo2 size={17} />
        </IconButton>
        <IconButton label="Opnieuw (Ctrl+Y)" tone="dark" disabled={!canRedo} onClick={redo} data-testid="redo">
          <Redo2 size={17} />
        </IconButton>
        <Menu />
      </div>

      <Link
        to="/bestellijst"
        data-testid="topbar-total"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-volt px-2.5 text-[13px] font-bold text-volt-ink transition hover:bg-volt-deep sm:gap-2 sm:px-3"
        title="Naar het besteloverzicht"
      >
        <ShoppingCart size={16} className="hidden min-[400px]:block" />
        <span className="tabular hidden sm:inline" data-testid="topbar-total-amount">
          {formatEuroCompact(order.totalCents)}
        </span>
        <span className="tabular sm:hidden">{formatEuroRounded(order.totalCents)}</span>
        {order.itemCount > 0 && <span className="tabular hidden rounded-full bg-volt-ink/15 px-1.5 text-[11px] sm:inline">{order.itemCount}</span>}
      </Link>
    </header>
  );
}
