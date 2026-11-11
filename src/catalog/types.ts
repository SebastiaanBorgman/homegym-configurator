import type { Clearance, Dimensions, Mobility } from '../domain/types';
import type { LayoutRole } from '../domain/layout/autoLayout';

/**
 * Datamodel van de productcatalogus.
 *
 * De catalogus is pure data: geen React, geen three.js. De interface en de 3D-modellen lezen
 * deze gegevens, maar staan er los van. Een latere koppeling met een CMS of product-API hoeft
 * alleen objecten in deze vorm aan te leveren.
 */

export type CategoryId =
  | 'racks'
  | 'banken'
  | 'barbells'
  | 'schijven'
  | 'dumbbells'
  | 'dumbbellrekken'
  | 'kabelstations'
  | 'krachtstations'
  | 'cardio'
  | 'accessoires';

export interface Category {
  id: CategoryId;
  label: string;
  short: string;
}

/**
 * Betrouwbaarheid van de fysieke afmetingen.
 * - verified:   alle drie de maten letterlijk overgenomen van de fabrikant- of leverancierspagina.
 * - partial:    een deel van de maten is geverifieerd; de rest is niet gepubliceerd en indicatief.
 * - derived:    berekend uit geverifieerde fabrikantmaten (bijv. stapelhoogte van schijven).
 * - unverified: niet zelf kunnen controleren op de bronpagina; uitsluitend ter demonstratie.
 */
export type VerificationStatus = 'verified' | 'partial' | 'derived' | 'unverified';

export interface DimensionRecord {
  status: VerificationStatus;
  /** Letterlijke opgave zoals gevonden in de bron. */
  quote: string;
  sourceLabel: string;
  sourceUrl: string;
  /** Hoe de bronmaten zijn afgebeeld op breedte (x), diepte (z) en hoogte (y). */
  mapping: string;
  /** Wat er precies is gemeten of inbegrepen. */
  measured: string;
  note?: string;
  /** Datum van controle, JJJJ-MM-DD. */
  checkedAt: string;
}

export interface Price {
  /** Prijs per stuk in euro; null = geen betrouwbare prijs gevonden. */
  amount: number | null;
  currency: 'EUR';
  /** Reguliere prijs als `amount` een tijdelijke actieprijs was op de controledatum. */
  regularAmount?: number;
  includesVat: boolean;
  note?: string;
  sourceUrl: string;
  checkedAt: string;
}

export interface Offer {
  supplierId: string;
  /** Echte productpagina bij de leverancier. */
  url: string;
  price: Price;
  /**
   * Voorbereid op affiliate marketing. Er zijn nog geen programma's actief:
   * `trackingUrl` blijft null totdat er een echte, door het netwerk uitgegeven link is.
   */
  affiliate: { enabled: boolean; trackingUrl: string | null };
}

export interface Supplier {
  id: string;
  name: string;
  website: string;
  /** Verzendt naar Nederland. */
  shipsToNl: boolean;
  affiliateProgram: {
    status: 'niet-aangesloten' | 'aangevraagd' | 'actief';
    network: string | null;
    note: string;
  };
}

export type ModelKind =
  | 'powerRack'
  | 'halfRack'
  | 'adjustableBench'
  | 'utilityBench'
  | 'barbell'
  | 'plateStack'
  | 'dumbbellRack'
  | 'storageRack'
  | 'dumbbellTower'
  | 'adjustableDumbbell'
  | 'functionalTrainer'
  | 'multiGym'
  | 'leverageGym'
  | 'allInOne'
  | 'rower'
  | 'bikeErg'
  | 'skiErg'
  | 'airBike'
  | 'treadmill'
  | 'crosstrainer'
  | 'kettlebell'
  | 'plyoBox'
  | 'box';

export interface ModelSpec {
  kind: ModelKind;
  params?: Record<string, number | string | boolean | number[]>;
}

export type CollisionShape = 'box' | 'openRack' | 'halfRack' | 'allInOne';

export interface Product {
  id: string;
  brand: string;
  name: string;
  /** Uitvoering of variant, indien van toepassing. */
  variant?: string;
  sku?: string;
  category: CategoryId;
  description: string;
  highlights: string[];
  /** Fysieke buitenmaten in METERS in de plaatsingsstand (zie domain/types.ts voor de assen). */
  dimensions: Dimensions;
  dimensionInfo: DimensionRecord;
  weightKg?: number;
  offers: Offer[];
  /**
   * Het 3D-model is altijd een vereenvoudigde, zelfgebouwde reconstructie binnen de
   * opgegeven buitenmaten — geen exacte digitale replica van het product.
   */
  model: ModelSpec;
  mobility: Mobility;
  collision: CollisionShape;
  /** Buisdikte voor open frames (m). */
  tube?: number;
  clearance?: Clearance;
  overheadUse?: boolean;
  layoutRole: LayoutRole;
}
