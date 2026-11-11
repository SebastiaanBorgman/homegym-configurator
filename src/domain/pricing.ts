import type { PlacedItem } from './types';

/**
 * Prijslogica. Alle bedragen worden intern in hele EUROCENTEN gerekend,
 * zodat optellen nooit afrondingsfouten van drijvende-kommagetallen geeft.
 */

export interface PriceLookupResult {
  /** Prijs per stuk in centen, of null als er geen betrouwbare prijs bekend is. */
  unitCents: number | null;
}

export type PriceLookup = (productId: string) => PriceLookupResult;

export interface OrderLine {
  productId: string;
  label: string;
  quantity: number;
  unitCents: number | null;
  lineCents: number | null;
  /** De geplaatste apparaten achter deze regel. */
  itemIds: string[];
}

export interface OrderSummary {
  lines: OrderLine[];
  /** Som van alle regels met een bekende prijs. */
  totalCents: number;
  /** Aantal stuks in totaal. */
  itemCount: number;
  /** Aantal stuks waarvan de prijs onbekend is (niet in het totaal opgenomen). */
  unpricedCount: number;
}

export const toCents = (euros: number): number => Math.round(euros * 100);

export function buildOrder(items: PlacedItem[], priceOf: PriceLookup): OrderSummary {
  const byProduct = new Map<string, OrderLine>();
  for (const item of items) {
    let line = byProduct.get(item.productId);
    if (!line) {
      line = {
        productId: item.productId,
        label: item.label,
        quantity: 0,
        unitCents: priceOf(item.productId).unitCents,
        lineCents: null,
        itemIds: [],
      };
      byProduct.set(item.productId, line);
    }
    line.quantity += 1;
    line.itemIds.push(item.id);
  }

  let totalCents = 0;
  let itemCount = 0;
  let unpricedCount = 0;
  const lines = [...byProduct.values()];
  for (const line of lines) {
    itemCount += line.quantity;
    if (line.unitCents === null) {
      unpricedCount += line.quantity;
    } else {
      line.lineCents = line.unitCents * line.quantity;
      totalCents += line.lineCents;
    }
  }
  return { lines, totalCents, itemCount, unpricedCount };
}

const euroFormat = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const euroFormatWhole = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** Formatteert centen als bedrag, bijv. 111500 → "€ 1.115,00". */
export function formatEuro(cents: number): string {
  return euroFormat.format(cents / 100);
}

/** Afgerond op hele euro's, voor plekken met weinig ruimte. */
export function formatEuroRounded(cents: number): string {
  return euroFormatWhole.format(Math.round(cents / 100));
}

/** Compacte weergave zonder centen wanneer het een rond bedrag is. */
export function formatEuroCompact(cents: number): string {
  return cents % 100 === 0 ? euroFormatWhole.format(cents / 100) : euroFormat.format(cents / 100);
}
