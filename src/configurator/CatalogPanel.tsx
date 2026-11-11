import { Plus, Search, SearchX, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { CATEGORIES, PRODUCTS, countByCategory, searchProducts, type CategoryId, type Product } from '../catalog';
import { classNames, formatDims } from '../lib/format';
import { useDesignStore } from '../state/designStore';
import { toast, useUiStore } from '../state/uiStore';
import { EmptyState } from '../ui/primitives';
import { PriceTag, ProductThumb, StatusBadge } from '../ui/product';

const counts = countByCategory();

const ProductCard = memo(function ProductCard({ product, placed }: { product: Product; placed: number }) {
  const open = () => useUiStore.getState().openProduct(product.id);
  const add = () => {
    const id = useDesignStore.getState().addProduct(product.id);
    if (id) toast('success', `${product.brand} ${product.name} toegevoegd`, 'Sleep het apparaat naar de gewenste plek.');
    useUiStore.getState().setMobileSheet(null);
  };
  return (
    <li
      data-testid={`product-${product.id}`}
      className="group relative flex gap-3 rounded-2xl border border-sand-200 bg-white p-2.5 transition hover:border-ink-300 hover:shadow-card"
    >
      <button type="button" onClick={open} className="shrink-0 rounded-xl" aria-label={`Details van ${product.brand} ${product.name}`}>
        <ProductThumb productId={product.id} className="size-[84px] rounded-xl" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <button type="button" onClick={open} className="min-w-0 text-left">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-400">{product.brand}</span>
          <span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-ink-900 group-hover:underline">
            {product.name}
            {product.variant && <span className="font-normal text-ink-500"> · {product.variant}</span>}
          </span>
        </button>
        <span className="tabular mt-1 block text-xs text-ink-500" title="Breedte × diepte × hoogte">
          {formatDims(product.dimensions)}
        </span>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <span className="flex flex-col gap-1">
            <PriceTag product={product} />
            {product.dimensionInfo.status !== 'verified' && <StatusBadge status={product.dimensionInfo.status} />}
          </span>
          <button
            type="button"
            onClick={add}
            data-testid={`add-${product.id}`}
            aria-label={`${product.brand} ${product.name} toevoegen aan mijn gym`}
            title="Toevoegen aan mijn gym"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white transition hover:bg-volt hover:text-volt-ink active:scale-95"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      {placed > 0 && (
        <span className="tabular absolute left-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-volt px-1.5 text-[11px] font-bold text-volt-ink shadow-card">
          {placed}×
        </span>
      )}
    </li>
  );
});

export function CatalogPanel() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'alle'>('alle');
  const items = useDesignStore((s) => s.design.items);

  const placedCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) map.set(i.productId, (map.get(i.productId) ?? 0) + 1);
    return map;
  }, [items]);

  const results = useMemo(() => searchProducts(query, category), [query, category]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 px-4 pb-3 pt-4">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op merk, product of type…"
            aria-label="Zoek in de catalogus"
            data-testid="catalog-search"
            className="h-10 w-full rounded-xl border border-sand-300 bg-white pl-9 pr-9 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" aria-label="Zoekopdracht wissen" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:text-ink-900">
              <X size={15} />
            </button>
          )}
        </label>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="Categorieën">
          {[{ id: 'alle' as const, short: 'Alles', label: 'Alle producten' }, ...CATEGORIES].map((c) => {
            const active = category === c.id;
            const n = c.id === 'alle' ? PRODUCTS.length : (counts.get(c.id) ?? 0);
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={c.label}
                data-testid={`category-${c.id}`}
                onClick={() => setCategory(c.id)}
                className={classNames(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
                  active ? 'border-ink-900 bg-ink-900 text-white' : 'border-sand-300 bg-white text-ink-600 hover:border-ink-400',
                )}
              >
                {c.short}
                <span className={classNames('tabular text-[10px]', active ? 'text-volt' : 'text-ink-400')}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="mb-2 text-xs text-ink-400" aria-live="polite" data-testid="catalog-count">
          {results.length} {results.length === 1 ? 'product' : 'producten'}
          {category !== 'alle' && ` in ${CATEGORIES.find((c) => c.id === category)?.label.toLowerCase()}`}
        </p>
        {results.length === 0 ? (
          <EmptyState icon={<SearchX size={20} />} title="Geen producten gevonden">
            Probeer een andere zoekterm of kies een andere categorie.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} placed={placedCounts.get(p.id) ?? 0} />
            ))}
          </ul>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
          Afbeeldingen zijn eigen, vereenvoudigde 3D-illustraties op ware grootte. Maten: breedte × diepte × hoogte. Prijzen zijn
          indicatief en incl. btw.
        </p>
      </div>
    </div>
  );
}
