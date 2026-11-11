import {
  ArrowDownToLine,
  CircleAlert,
  CircleCheck,
  Copy,
  Dumbbell,
  ExternalLink,
  Info,
  ListChecks,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CHECKED, LAYOUT_PROFILES, STATUS_META, getProduct, outboundUrl, primaryOffer, specOf, supplierOf } from '../catalog';
import type { Issue, Severity } from '../domain/geometry/validation';
import { formatEuro } from '../domain/pricing';
import { WALL_LABELS, type PlacedItem, type WallId } from '../domain/types';
import { classNames, formatDate, formatDims } from '../lib/format';
import { useDerived } from '../state/derived';
import { useDesignStore } from '../state/designStore';
import { useUiStore } from '../state/uiStore';
import { Button, EmptyState, IconButton, NumberField, SectionTitle, buttonClass } from '../ui/primitives';
import { ProductThumb, StatusBadge } from '../ui/product';
import { generateLayoutAction } from './actions';

// ───────────────────────────────────── Inspecteur ─────────────────────────────────────

const SEVERITY_DOT: Record<Severity, string> = { error: 'bg-danger', warning: 'bg-warn', info: 'bg-info' };

/** Details en nauwkeurige bediening van het geselecteerde apparaat. */
export function Inspector() {
  const selection = useDesignStore((s) => s.selection);
  const item = useDesignStore((s) => (s.selection?.kind === 'item' ? s.design.items.find((i) => i.id === s.selection!.id) : undefined));
  const { issues } = useDerived();
  if (!selection || selection.kind !== 'item' || !item) return null;

  const store = useDesignStore.getState();
  const product = getProduct(item.productId);
  const spec = specOf(item);
  const mine = issues.filter((i) => i.itemIds.includes(item.id));
  const walls: WallId[] = ['north', 'east', 'south', 'west'];

  return (
    <section className="border-b border-sand-200 bg-white px-4 py-4" data-testid="inspector" aria-label="Geselecteerd apparaat">
      <div className="flex gap-3">
        <ProductThumb productId={item.productId} className="size-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Geselecteerd</p>
          <p className="truncate text-sm font-semibold text-ink-900" title={item.label}>
            {item.label}
          </p>
          <p className="tabular text-xs text-ink-500" data-testid="inspector-dims">
            {formatDims(item.dimensions)}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {product ? (
          <>
            <StatusBadge status={product.dimensionInfo.status} />
            <button type="button" className="text-xs font-semibold text-info hover:underline" onClick={() => useUiStore.getState().openProduct(product.id)}>
              Productinformatie
            </button>
          </>
        ) : (
          <span className="rounded-full bg-sand-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600">Niet in catalogus — blok op opgeslagen maten</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumberField testId="item-x" label="X" unit="cm" scale={100} decimals={1} step={0.01} value={item.x} onCommit={(v) => store.updateItem(item.id, { x: v })} />
        <NumberField testId="item-z" label="Z" unit="cm" scale={100} decimals={1} step={0.01} value={item.z} onCommit={(v) => store.updateItem(item.id, { z: v })} />
        <NumberField testId="item-rotation" label="Draaiing" unit="°" decimals={1} step={15} min={-360} max={720} value={item.rotationDeg} onCommit={(v) => store.updateItem(item.id, { rotationDeg: v })} />
      </div>
      {spec.mobility === 'portable' && (
        <NumberField
          className="mt-2"
          testId="item-y"
          label="Hoogte boven de vloer (bijv. stang op J-cups)"
          unit="cm"
          scale={100}
          decimals={1}
          step={0.05}
          min={0}
          value={item.y}
          onCommit={(v) => store.updateItem(item.id, { y: v })}
        />
      )}
      <p className="mt-1.5 text-[11px] text-ink-400">Positie = midden van het apparaat, gemeten vanaf de hoek achterwand/linkerwand.</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => store.rotateItem(item.id, 90)} title="90° tegen de klok in (Shift+R)">
          90°
        </Button>
        <Button size="sm" icon={<RotateCw size={14} />} onClick={() => store.rotateItem(item.id, -90)} title="90° met de klok mee (R)" data-testid="rotate-90">
          90°
        </Button>
        <Button size="sm" icon={<Copy size={14} />} onClick={() => store.duplicateItem(item.id)} title="Dupliceren (Ctrl+D)" data-testid="duplicate">
          Dupliceer
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => store.removeItem(item.id)} title="Verwijderen (Delete)" data-testid="delete">
          Verwijder
        </Button>
      </div>

      <div className="mt-3">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">Met de rug tegen een muur</span>
        <div className="grid grid-cols-4 gap-1.5">
          {walls.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => store.moveItemToWall(item.id, w)}
              data-testid={`to-wall-${w}`}
              className="rounded-lg border border-sand-300 bg-white px-1 py-1.5 text-[11px] font-semibold text-ink-700 transition hover:border-ink-900"
            >
              {WALL_LABELS[w].replace('wand', '')}
            </button>
          ))}
        </div>
      </div>

      {mine.length > 0 && (
        <ul className="mt-3 space-y-1.5" data-testid="inspector-issues">
          {mine.map((issue) => (
            <li key={issue.id} className="flex gap-2 rounded-xl bg-sand-100 p-2.5 text-xs leading-snug">
              <span className={classNames('mt-1 size-2 shrink-0 rounded-full', SEVERITY_DOT[issue.severity])} />
              <span>
                <span className="font-semibold text-ink-900">{issue.title}</span>
                <span className="block text-ink-500">{issue.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────── Indeling: generator + overzicht ───────────────────────────────

function GeneratorCard() {
  const [profile, setProfile] = useState(LAYOUT_PROFILES[1].id);
  const count = useDesignStore((s) => s.design.items.length);
  const [confirming, setConfirming] = useState(false);

  const run = () => {
    setConfirming(false);
    generateLayoutAction(profile);
    useUiStore.getState().setMobileSheet(null);
  };

  return (
    <div className="rounded-2xl bg-ink-900 p-4 text-white">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-xl bg-volt text-volt-ink">
          <WandSparkles size={16} />
        </span>
        <div>
          <h3 className="text-sm font-bold">Genereer een indeling</h3>
          <p className="text-xs text-ink-300">Een voorstel dat rekening houdt met maten, deuren en obstakels.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Type homegym">
        {LAYOUT_PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={profile === p.id}
            title={p.description}
            data-testid={`profile-${p.id}`}
            onClick={() => setProfile(p.id)}
            className={classNames(
              'rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition',
              profile === p.id ? 'border-volt bg-volt/10 text-volt' : 'border-white/15 text-ink-200 hover:border-white/40',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-8 text-xs leading-relaxed text-ink-300">{LAYOUT_PROFILES.find((p) => p.id === profile)?.description}</p>
      {confirming ? (
        <div className="mt-2 rounded-xl bg-white/10 p-3">
          <p className="text-xs leading-relaxed text-ink-100">Dit vervangt de {count} apparaten die er nu staan. Je kunt het ongedaan maken.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="primary" size="sm" onClick={run} data-testid="generate-confirm">
              Vervangen
            </Button>
            <button type="button" className="h-8 rounded-lg px-3 text-[13px] font-semibold text-ink-200 hover:bg-white/10" onClick={() => setConfirming(false)}>
              Annuleren
            </button>
          </div>
        </div>
      ) : (
        <Button variant="primary" block className="mt-2" icon={<WandSparkles size={16} />} onClick={() => (count > 0 ? setConfirming(true) : run())} data-testid="generate">
          {count > 0 ? 'Nieuwe indeling genereren' : 'Genereer een indeling'}
        </Button>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-400">Een suggestie — geen gegarandeerd optimale of veilige indeling. Pas alles daarna zelf aan.</p>
    </div>
  );
}

function PlacedRow({ item, severity, selected }: { item: PlacedItem; severity?: Severity; selected: boolean }) {
  const store = useDesignStore.getState();
  return (
    <li>
      <div
        className={classNames(
          'flex items-center gap-2.5 rounded-xl border bg-white p-1.5 pr-1 transition',
          selected ? 'border-info ring-2 ring-info/15' : 'border-sand-200 hover:border-ink-300',
        )}
      >
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => store.select({ kind: 'item', id: item.id })} data-testid="placed-item">
          <ProductThumb productId={item.productId} className="size-10 shrink-0 rounded-lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink-900">{item.label}</span>
            <span className="tabular block text-[11px] text-ink-400">
              x {Math.round(item.x * 100)} · z {Math.round(item.z * 100)} cm · {Math.round(item.rotationDeg)}°
            </span>
          </span>
          {severity && <span className={classNames('size-2 shrink-0 rounded-full', SEVERITY_DOT[severity])} title={severity === 'error' ? 'Past niet' : 'Aandachtspunt'} />}
        </button>
        <IconButton label={`${item.label} verwijderen`} tone="danger" size="sm" onClick={() => store.removeItem(item.id)}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </li>
  );
}

export function LayoutPanel({ withInspector }: { withInspector: boolean }) {
  const items = useDesignStore((s) => s.design.items);
  const selectionId = useDesignStore((s) => s.selection?.id);
  const { severityByItem } = useDerived();
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      {withInspector && <Inspector />}
      <div className="space-y-5 px-4 py-4">
        <GeneratorCard />
        <section>
          <SectionTitle
            action={
              items.length > 0 ? (
                <button type="button" className="text-xs font-semibold text-ink-400 hover:text-danger" onClick={() => useDesignStore.getState().clearItems()} data-testid="clear-items">
                  Alles verwijderen
                </button>
              ) : undefined
            }
          >
            Geplaatste apparaten ({items.length})
          </SectionTitle>
          {items.length === 0 ? (
            <EmptyState icon={<Dumbbell size={20} />} title="Nog geen apparaten geplaatst">
              Voeg apparatuur toe vanuit de catalogus of laat hierboven een indeling genereren.
            </EmptyState>
          ) : (
            <ul className="space-y-1.5" data-testid="placed-list">
              {items.map((i) => (
                <PlacedRow key={i.id} item={i} severity={severityByItem.get(i.id)} selected={selectionId === i.id} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ───────────────────────────────────── Ruimtecontrole ─────────────────────────────────────

const ISSUE_STYLE: Record<Severity, { icon: ReactNode; tone: string; label: string }> = {
  error: { icon: <CircleAlert size={16} />, tone: 'text-danger bg-danger-soft', label: 'Past niet' },
  warning: { icon: <TriangleAlert size={16} />, tone: 'text-[#9a6200] bg-warn-soft', label: 'Let op' },
  info: { icon: <Info size={16} />, tone: 'text-info bg-info-soft', label: 'Ter info' },
};

function IssueRow({ issue }: { issue: Issue }) {
  const style = ISSUE_STYLE[issue.severity];
  return (
    <li>
      <button
        type="button"
        onClick={() => useDesignStore.getState().select({ kind: 'item', id: issue.itemIds[0] })}
        className="flex w-full gap-3 rounded-2xl border border-sand-200 bg-white p-3 text-left transition hover:border-ink-300"
        data-testid={`issue-${issue.code}`}
        data-severity={issue.severity}
      >
        <span className={classNames('inline-flex size-8 shrink-0 items-center justify-center rounded-xl', style.tone)}>{style.icon}</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-snug text-ink-900">{issue.title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{issue.detail}</span>
        </span>
      </button>
    </li>
  );
}

export function ChecksPanel() {
  const { issues, summary } = useDerived();
  const itemCount = useDesignStore((s) => s.design.items.length);
  const showAllZones = useUiStore((s) => s.showAllZones);
  const clean = issues.length === 0;
  return (
    <div className="scroll-thin h-full overflow-y-auto px-4 py-4">
      <div
        data-testid="checks-summary"
        data-errors={summary.errors}
        data-warnings={summary.warnings}
        className={classNames('mb-4 flex items-center gap-3 rounded-2xl p-3.5', summary.errors ? 'bg-danger-soft' : summary.warnings ? 'bg-warn-soft' : 'bg-ok-soft')}
      >
        <span
          className={classNames(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white',
            summary.errors ? 'bg-danger' : summary.warnings ? 'bg-warn' : 'bg-ok',
          )}
        >
          {summary.errors ? <CircleAlert size={18} /> : summary.warnings ? <TriangleAlert size={18} /> : <CircleCheck size={18} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-900">
            {itemCount === 0
              ? 'Nog niets te controleren'
              : summary.errors
                ? `${summary.errors} ${summary.errors === 1 ? 'apparaat past niet' : 'problemen gevonden'}`
                : summary.warnings
                  ? `${summary.warnings} ${summary.warnings === 1 ? 'aandachtspunt' : 'aandachtspunten'}`
                  : 'Alles past in de ruimte'}
          </p>
          <p className="text-xs text-ink-600">
            {itemCount === 0 ? 'Plaats apparatuur om de ruimtecontrole te starten.' : 'Berekend op de werkelijke maten: muren, plafond, overlap, obstakels en deuren.'}
          </p>
        </div>
      </div>

      {clean && itemCount > 0 && (
        <EmptyState icon={<ListChecks size={20} />} title="Geen meldingen">
          Geen overlap, niets door een muur en alles past onder het plafond.
        </EmptyState>
      )}
      <ul className="space-y-2" data-testid="issue-list">
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </ul>

      <div className="mt-5 rounded-2xl border border-sand-200 bg-white p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="block text-[13px] font-semibold text-ink-800">Gebruiksruimte van alle apparaten tonen</span>
            <span className="block text-xs text-ink-400">Blauw = opgave fabrikant · grijs = indicatief</span>
          </span>
          <input type="checkbox" className="size-4 accent-ink-900" checked={showAllZones} onChange={(e) => useUiStore.getState().setPreference('showAllZones', e.target.checked)} />
        </label>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        De ruimtecontrole geeft ruimtelijke informatie en is geen formele veiligheidskeuring. Indicatieve gebruiksruimtes zijn eigen
        vuistregels, geen fabrikantseisen. Raadpleeg altijd de handleiding van het product.
      </p>
    </div>
  );
}

// ───────────────────────────────────── Bestellijst ─────────────────────────────────────

export function OrderPanel() {
  const { order } = useDerived();
  const store = useDesignStore.getState();

  if (order.lines.length === 0) {
    return (
      <div className="px-4 py-4">
        <EmptyState icon={<ShoppingCart size={20} />} title="Je bestellijst is nog leeg">
          Elk apparaat dat je in de ruimte plaatst, verschijnt hier met prijs en link naar de leverancier.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" data-testid="order-lines">
        {order.lines.map((line) => {
          const product = getProduct(line.productId);
          const offer = product ? primaryOffer(product) : undefined;
          const supplier = product ? supplierOf(product) : undefined;
          return (
            <li key={line.productId} className="rounded-2xl border border-sand-200 bg-white p-3" data-testid={`order-line-${line.productId}`}>
              <div className="flex gap-3">
                <ProductThumb productId={line.productId} className="size-12 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{product?.brand ?? 'Onbekend'}</p>
                  <p className="text-[13px] font-semibold leading-snug text-ink-900">
                    {product ? product.name : line.label}
                    {product?.variant && <span className="font-normal text-ink-500"> · {product.variant}</span>}
                  </p>
                  <p className="tabular mt-0.5 text-xs text-ink-500">{line.unitCents !== null ? `${formatEuro(line.unitCents)} per stuk` : 'Prijs onbekend'}</p>
                </div>
                <IconButton label={`${line.label} uit de lijst verwijderen`} tone="danger" size="sm" onClick={() => store.removeAllOfProduct(line.productId)} data-testid={`order-remove-${line.productId}`}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="inline-flex items-center rounded-lg border border-sand-300">
                  <IconButton label="Eén minder" size="sm" onClick={() => store.removeOneOfProduct(line.productId)} data-testid={`order-minus-${line.productId}`}>
                    <Minus size={14} />
                  </IconButton>
                  <span className="tabular w-7 text-center text-[13px] font-bold text-ink-900" data-testid={`order-qty-${line.productId}`}>
                    {line.quantity}
                  </span>
                  <IconButton label="Eén meer" size="sm" disabled={!product} onClick={() => product && store.addProduct(product.id)} data-testid={`order-plus-${line.productId}`}>
                    <Plus size={14} />
                  </IconButton>
                </div>
                <span className="tabular text-sm font-bold text-ink-900" data-testid={`order-total-${line.productId}`}>
                  {line.lineCents !== null ? formatEuro(line.lineCents) : '—'}
                </span>
              </div>
              {offer && (
                <a
                  href={outboundUrl(offer)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-info hover:underline"
                >
                  Bekijk bij {supplier?.name ?? 'leverancier'} <ExternalLink size={12} />
                </a>
              )}
              {product && product.dimensionInfo.status === 'unverified' && (
                <p className="mt-1.5 text-[11px] font-medium text-danger">{STATUS_META.unverified.label} — controleer de maten bij de leverancier.</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-sand-200 bg-white px-4 py-3.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-ink-500">
              Totaal apparatuur · {order.itemCount} {order.itemCount === 1 ? 'stuk' : 'stuks'}
            </p>
            <p className="display tabular text-2xl text-ink-900" data-testid="order-total">
              {formatEuro(order.totalCents)}
            </p>
          </div>
          <Link to="/bestellijst" className={buttonClass('dark', 'md')} data-testid="open-order-page">
            <ArrowDownToLine size={16} /> Besteloverzicht
          </Link>
        </div>
        {order.unpricedCount > 0 && (
          <p className="mt-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-xs font-medium text-[#8a5800]" data-testid="unpriced-note">
            {order.unpricedCount} {order.unpricedCount === 1 ? 'product heeft' : 'producten hebben'} geen bekende prijs en {order.unpricedCount === 1 ? 'telt' : 'tellen'} niet mee in
            het totaal.
          </p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
          Indicatieve prijzen incl. btw, gecontroleerd op {formatDate(CHECKED)}. Je bestelt
          bij de leverancier zelf; er is geen gezamenlijke kassa.
        </p>
      </div>
    </div>
  );
}
