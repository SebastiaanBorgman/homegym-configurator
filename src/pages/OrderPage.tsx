import { ArrowLeft, ClipboardCopy, ExternalLink, Printer, ShoppingCart, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { CHECKED, STATUS_META, getProduct, outboundUrl, primaryOffer, supplierById, type Product, type Supplier } from '../catalog';
import { BRAND } from '../config/brand';
import { formatEuro, type OrderLine } from '../domain/pricing';
import { formatDate, formatDims, meters } from '../lib/format';
import { useDerived } from '../state/derived';
import { useDesignStore } from '../state/designStore';
import { toast } from '../state/uiStore';
import { Button, EmptyState, IconButton, Toasts, buttonClass } from '../ui/primitives';
import { Logo } from '../ui/Logo';
import { ProductThumb, StatusBadge } from '../ui/product';

interface Row {
  line: OrderLine;
  product: Product | undefined;
}

interface Group {
  supplier: Supplier | undefined;
  rows: Row[];
  subtotalCents: number;
}

/** Het complete besteloverzicht: per leverancier gegroepeerd, met links naar de webshops. */
export default function OrderPage() {
  const design = useDesignStore((s) => s.design);
  const { order, summary } = useDerived();

  useEffect(() => {
    document.title = `Besteloverzicht — ${BRAND.name}`;
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const line of order.lines) {
      const product = getProduct(line.productId);
      const supplierId = product ? primaryOffer(product).supplierId : 'onbekend';
      let group = map.get(supplierId);
      if (!group) {
        group = { supplier: supplierById.get(supplierId), rows: [], subtotalCents: 0 };
        map.set(supplierId, group);
      }
      group.rows.push({ line, product });
      group.subtotalCents += line.lineCents ?? 0;
    }
    return [...map.values()];
  }, [order]);

  const copyList = async () => {
    const lines = [
      `Besteloverzicht — ${design.name}`,
      `Ruimte: ${meters(design.room.width)} × ${meters(design.room.length)} × ${meters(design.room.height)}`,
      '',
      ...groups.flatMap((g) => [
        `${g.supplier?.name ?? 'Onbekende leverancier'}`,
        ...g.rows.map(({ line, product }) => {
          const price = line.lineCents !== null ? formatEuro(line.lineCents) : 'prijs onbekend';
          const url = product ? primaryOffer(product).url : '';
          return `  ${line.quantity}× ${line.label}${product?.variant ? ` (${product.variant})` : ''} — ${price}${url ? ` — ${url}` : ''}`;
        }),
        '',
      ]),
      `Totaal (indicatief, incl. btw): ${formatEuro(order.totalCents)}`,
      `Prijzen gecontroleerd op ${formatDate(CHECKED)}.`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('success', 'Lijst gekopieerd', 'Plak hem in een bericht of notitie.');
    } catch {
      toast('error', 'Kopiëren mislukt', 'Je browser staat geen toegang tot het klembord toe.');
    }
  };

  return (
    <div className="min-h-dvh bg-sand-100">
      <header className="no-print bg-ink-900 text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Naar de homepage" className="rounded-lg">
            <Logo tone="dark" />
          </Link>
          <Link to="/configurator" className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-ink-100 hover:bg-white/10" data-testid="back-to-design">
            <ArrowLeft size={16} /> Terug naar het ontwerp
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="eyebrow text-ink-400">Besteloverzicht</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-3xl text-ink-900 sm:text-4xl" data-testid="order-title">
              {design.name}
            </h1>
            <p className="tabular mt-2 text-sm text-ink-500">
              Ruimte {meters(design.room.width)} × {meters(design.room.length)} × {meters(design.room.height)} · {order.itemCount}{' '}
              {order.itemCount === 1 ? 'product' : 'producten'}
            </p>
          </div>
          {order.lines.length > 0 && (
            <div className="no-print flex gap-2">
              <Button icon={<ClipboardCopy size={16} />} onClick={() => void copyList()}>
                Kopieer lijst
              </Button>
              <Button icon={<Printer size={16} />} onClick={() => window.print()}>
                Afdrukken
              </Button>
            </div>
          )}
        </div>

        {order.lines.length === 0 ? (
          <div className="mt-10">
            <EmptyState icon={<ShoppingCart size={20} />} title="Er staat nog niets in je ontwerp">
              Plaats apparatuur in de configurator; die verschijnt hier vanzelf met prijs en leverancier.
            </EmptyState>
            <div className="mt-5 text-center">
              <Link to="/configurator" className={buttonClass('primary', 'md')}>
                Naar de configurator
              </Link>
            </div>
          </div>
        ) : (
          <>
            {summary.errors > 0 && (
              <p className="mt-6 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" data-testid="order-issues">
                Let op: de ruimtecontrole meldt nog {summary.errors} {summary.errors === 1 ? 'probleem' : 'problemen'} in dit ontwerp. Controleer of alles past
                voordat je bestelt.
              </p>
            )}

            <div className="mt-8 space-y-6">
              {groups.map((group) => (
                <section key={group.supplier?.id ?? 'onbekend'} className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-card" data-testid={`supplier-${group.supplier?.id ?? 'onbekend'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 bg-sand-50 px-5 py-3.5">
                    <div>
                      <h2 className="text-base font-bold text-ink-900">{group.supplier?.name ?? 'Niet in de catalogus'}</h2>
                      {group.supplier && !group.supplier.shipsToNl && <p className="text-xs text-warn">Levering naar Nederland niet gecontroleerd.</p>}
                    </div>
                    {group.supplier && (
                      <a href={group.supplier.website} target="_blank" rel="noopener noreferrer" className="no-print inline-flex items-center gap-1 text-[13px] font-semibold text-info hover:underline">
                        Naar de webshop <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <ul className="divide-y divide-sand-200">
                    {group.rows.map(({ line, product }) => {
                      const offer = product ? primaryOffer(product) : undefined;
                      return (
                        <li key={line.productId} className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center" data-testid={`order-row-${line.productId}`}>
                          <ProductThumb productId={line.productId} className="hidden size-16 rounded-xl sm:flex" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink-900">
                              {product ? `${product.brand} ${product.name}` : line.label}
                              {product?.variant && <span className="font-normal text-ink-500"> · {product.variant}</span>}
                            </p>
                            <p className="tabular mt-0.5 text-xs text-ink-500">
                              {product ? formatDims(product.dimensions) : 'Onbekend product'}
                              {product?.sku && ` · art. ${product.sku}`}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              {product && <StatusBadge status={product.dimensionInfo.status} />}
                              {offer && (
                                <a
                                  href={outboundUrl(offer)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-info hover:underline"
                                  data-testid={`order-link-${line.productId}`}
                                >
                                  Productpagina <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                            {offer?.price.note && <p className="mt-1 text-xs text-ink-400">{offer.price.note}</p>}
                            {product?.dimensionInfo.status === 'unverified' && <p className="mt-1 text-xs font-medium text-danger">{STATUS_META.unverified.description}</p>}
                          </div>
                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <div className="tabular text-right text-sm">
                              <p className="text-ink-500">
                                {line.quantity} × {line.unitCents !== null ? formatEuro(line.unitCents) : 'prijs onbekend'}
                              </p>
                              <p className="font-bold text-ink-900">{line.lineCents !== null ? formatEuro(line.lineCents) : '—'}</p>
                            </div>
                            <IconButton className="no-print" label={`${line.label} verwijderen`} tone="danger" onClick={() => useDesignStore.getState().removeAllOfProduct(line.productId)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="tabular flex justify-between border-t border-sand-200 bg-sand-50 px-5 py-3 text-sm">
                    <span className="text-ink-500">Subtotaal {group.supplier?.name ?? ''}</span>
                    <span className="font-bold text-ink-900">{formatEuro(group.subtotalCents)}</span>
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-6 rounded-3xl bg-ink-900 px-6 py-6 text-white">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-300">Totale apparatuurwaarde · indicatief, incl. btw</p>
                  <p className="display tabular mt-1 text-4xl" data-testid="order-page-total">
                    {formatEuro(order.totalCents)}
                  </p>
                </div>
                <p className="max-w-xs text-xs leading-relaxed text-ink-300">Verzendkosten en kortingen van de leveranciers zijn niet meegerekend.</p>
              </div>
              {order.unpricedCount > 0 && (
                <p className="mt-4 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">
                  {order.unpricedCount} {order.unpricedCount === 1 ? 'product heeft' : 'producten hebben'} geen bekende prijs en {order.unpricedCount === 1 ? 'is' : 'zijn'} niet in het totaal
                  opgenomen.
                </p>
              )}
            </div>

            <ul className="mt-6 space-y-2 text-xs leading-relaxed text-ink-500">
              <li>
                <strong className="text-ink-700">Prijzen zijn indicatief.</strong> Ze zijn overgenomen van de pagina’s van de leveranciers op {formatDate(CHECKED)} en kunnen
                inmiddels zijn gewijzigd. Actieprijzen zijn tijdelijk.
              </li>
              <li>
                <strong className="text-ink-700">Je bestelt bij de leverancier zelf.</strong> Er is geen gezamenlijke kassa; elke link opent de productpagina in een nieuw tabblad.
              </li>
              <li>
                <strong className="text-ink-700">Geen commissie.</strong> De links zijn op dit moment gewone links. Later kunnen dit affiliate-links worden; dat vermelden we dan
                duidelijk.
              </li>
            </ul>
          </>
        )}
      </main>
      <Toasts />
    </div>
  );
}
