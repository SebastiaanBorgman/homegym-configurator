import { BadgeCheck, Box, CircleHelp, ExternalLink, Plus, Ruler, ShieldAlert, Sigma } from 'lucide-react';
import type { ReactNode } from 'react';
import { STATUS_META, categoryById, getProduct, outboundUrl, priceCents, primaryOffer, supplierOf, type Product, type VerificationStatus } from '../catalog';
import { formatEuro, formatEuroCompact } from '../domain/pricing';
import { classNames, cm, formatDate, formatDims } from '../lib/format';
import { useThumbnail } from '../scene/thumbnails';
import { useDesignStore } from '../state/designStore';
import { toast, useUiStore } from '../state/uiStore';
import { Button, Modal } from './primitives';

/** Eigen 3D-illustratie van een product; valt terug op een pictogram als die niet beschikbaar is. */
export function ProductThumb({ productId, className }: { productId: string; className?: string }) {
  const src = useThumbnail(productId);
  return (
    <span className={classNames('relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-sand-50 to-sand-200', className)}>
      {src === undefined && <span className="skeleton absolute inset-0" aria-hidden />}
      {src === null && <Box className="text-ink-300" size={28} aria-label="Geen afbeelding beschikbaar" />}
      {src && <img src={src} alt="" className="size-full object-contain" draggable={false} />}
    </span>
  );
}

const STATUS_STYLE: Record<VerificationStatus, { className: string; icon: ReactNode }> = {
  verified: { className: 'bg-ok-soft text-ok', icon: <BadgeCheck size={13} /> },
  partial: { className: 'bg-warn-soft text-[#9a6200]', icon: <Ruler size={13} /> },
  derived: { className: 'bg-info-soft text-info', icon: <Sigma size={13} /> },
  unverified: { className: 'bg-danger-soft text-danger', icon: <ShieldAlert size={13} /> },
};

export function StatusBadge({ status, long = false }: { status: VerificationStatus; long?: boolean }) {
  const meta = STATUS_META[status];
  const style = STATUS_STYLE[status];
  return (
    <span
      title={meta.description}
      data-status={status}
      className={classNames('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', style.className)}
    >
      {style.icon}
      {long ? meta.label : meta.short}
    </span>
  );
}

export function PriceTag({ product, size = 'md' }: { product: Product; size?: 'md' | 'lg' }) {
  const cents = priceCents(product);
  const regular = primaryOffer(product).price.regularAmount;
  if (cents === null) {
    return <span className={classNames('font-medium text-ink-400', size === 'lg' ? 'text-base' : 'text-[13px]')}>Prijs onbekend</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={classNames('tabular font-bold text-ink-900', size === 'lg' ? 'text-2xl' : 'text-sm')}>{formatEuroCompact(cents)}</span>
      {regular !== undefined && (
        <span className={classNames('tabular text-ink-400 line-through', size === 'lg' ? 'text-sm' : 'text-xs')}>{formatEuroCompact(Math.round(regular * 100))}</span>
      )}
    </span>
  );
}

function SpecRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-2 text-[13px]">
      <dt className="text-ink-400">{label}</dt>
      <dd className="min-w-0 text-ink-800">{children}</dd>
    </div>
  );
}

/** Detailvenster van een product, met maatvoering, bron en leverancier. */
export function ProductDialog() {
  const productId = useUiStore((s) => s.productDialogId);
  const close = () => useUiStore.getState().openProduct(null);
  const product = productId ? getProduct(productId) : undefined;
  const placed = useDesignStore((s) => (productId ? s.design.items.filter((i) => i.productId === productId).length : 0));

  if (!product) return null;
  const info = product.dimensionInfo;
  const offer = primaryOffer(product);
  const supplier = supplierOf(product);
  const cents = priceCents(product);
  const d = product.dimensions;

  const add = () => {
    const id = useDesignStore.getState().addProduct(product.id);
    if (id) toast('success', `${product.brand} ${product.name} toegevoegd`, 'Sleep het apparaat naar de gewenste plek.');
    close();
    useUiStore.getState().setMobileSheet(null);
  };

  return (
    <Modal open onClose={close} title={`${product.brand} ${product.name}`} wide testId="product-dialog">
      <div className="scroll-thin grid overflow-y-auto md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col bg-gradient-to-b from-sand-50 to-sand-200 p-6">
          <ProductThumb productId={product.id} className="aspect-square w-full rounded-2xl !bg-none" />
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-white/70 p-3 text-xs leading-relaxed text-ink-500">
            <CircleHelp size={14} className="mt-0.5 shrink-0" />
            <span>
              Vereenvoudigde 3D-weergave: zelf opgebouwd binnen de exacte buitenmaten van het product. Geen exacte replica en geen
              productfoto van de fabrikant.
            </span>
          </p>
        </div>

        <div className="p-6 md:p-7">
          <p className="eyebrow text-ink-400">{categoryById.get(product.category)?.label}</p>
          <h2 className="display mt-2 text-2xl text-ink-900">
            {product.brand} {product.name}
          </h2>
          {(product.variant || product.sku) && (
            <p className="mt-1.5 text-[13px] text-ink-500">
              {[product.variant, product.sku && `Artikelnr. ${product.sku}`].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-ink-600">{product.description}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {product.highlights.map((h) => (
              <li key={h} className="rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink-600">
                {h}
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-2xl border border-sand-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink-900">Afmetingen</h3>
              <StatusBadge status={info.status} long />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center" data-testid="product-dimensions">
              {[
                ['Breedte', d.width],
                ['Diepte', d.depth],
                ['Hoogte', d.height],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-xl bg-sand-100 px-2 py-2.5">
                  <div className="tabular text-lg font-bold text-ink-900">{cm(value as number)}</div>
                  <div className="text-[11px] font-medium text-ink-400">{label} · cm</div>
                </div>
              ))}
            </div>
            <dl className="mt-2 divide-y divide-sand-200">
              <SpecRow label="Opgave bron">
                <span className="break-words font-medium">“{info.quote}”</span>
              </SpecRow>
              <SpecRow label="Toegepast als">{info.mapping}</SpecRow>
              <SpecRow label="Wat is gemeten">{info.measured}</SpecRow>
              {info.note && (
                <SpecRow label="Let op">
                  <span className={info.status === 'unverified' ? 'font-medium text-danger' : undefined}>{info.note}</span>
                </SpecRow>
              )}
              {product.clearance && (
                <SpecRow label="Gebruiksruimte">
                  {product.clearance.note}{' '}
                  <span className="text-ink-400">
                    ({product.clearance.source === 'manufacturer' ? 'opgave fabrikant' : 'indicatief, geen officiële veiligheidseis'})
                  </span>
                </SpecRow>
              )}
              {product.weightKg !== undefined && <SpecRow label="Gewicht">{product.weightKg.toLocaleString('nl-NL')} kg</SpecRow>}
              <SpecRow label="Bron maten">
                <a href={info.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-info hover:underline">
                  {info.sourceLabel} <ExternalLink size={12} />
                </a>
                <span className="block text-xs text-ink-400">Gecontroleerd op {formatDate(info.checkedAt)}</span>
              </SpecRow>
            </dl>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <PriceTag product={product} size="lg" />
              <p className="mt-0.5 max-w-[34ch] text-xs leading-relaxed text-ink-400">
                {cents !== null ? `Indicatief, incl. btw · ${supplier?.name} · ${formatDate(offer.price.checkedAt)}` : offer.price.note}
                {cents !== null && offer.price.note ? ` · ${offer.price.note}` : ''}
              </p>
            </div>
            <a
              href={outboundUrl(offer)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-700 underline decoration-sand-300 underline-offset-4 hover:decoration-ink-700"
            >
              Bekijk bij {supplier?.name ?? 'leverancier'} <ExternalLink size={13} />
            </a>
          </div>

          <Button variant="primary" size="lg" block className="mt-5" icon={<Plus size={18} />} onClick={add} data-testid="dialog-add">
            Toevoegen aan mijn gym
          </Button>
          {placed > 0 && (
            <p className="mt-2 text-center text-xs text-ink-400">
              Staat al {placed}× in je ontwerp · {cents !== null ? formatEuro(cents * placed) : 'prijs onbekend'}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function dimsLine(product: Product): string {
  return formatDims(product.dimensions);
}
