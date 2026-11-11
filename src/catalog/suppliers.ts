import type { Supplier } from './types';

/**
 * Leveranciers. Er is nog met geen enkele partij een affiliate-overeenkomst:
 * alle uitgaande links zijn gewone links naar de productpagina.
 */
export const SUPPLIERS: Supplier[] = [
  {
    id: 'rogue',
    name: 'Rogue Fitness Europe',
    website: 'https://www.roguefitness.com/nl/en/',
    shipsToNl: true,
    affiliateProgram: { status: 'niet-aangesloten', network: null, note: 'Nog geen partnerprogramma onderzocht.' },
  },
  {
    id: 'tunturi',
    name: 'Tunturi',
    website: 'https://www.tunturi.com/nl/',
    shipsToNl: true,
    affiliateProgram: { status: 'niet-aangesloten', network: null, note: 'Nog geen partnerprogramma onderzocht.' },
  },
  {
    id: 'concept2',
    name: 'Concept2 Benelux',
    website: 'https://www.concept2.nl/',
    shipsToNl: true,
    affiliateProgram: { status: 'niet-aangesloten', network: null, note: 'Nog geen partnerprogramma onderzocht.' },
  },
  {
    id: 'bowflex',
    name: 'BowFlex',
    website: 'https://global.bowflex.com/nl/',
    shipsToNl: true,
    affiliateProgram: { status: 'niet-aangesloten', network: null, note: 'Nog geen partnerprogramma onderzocht.' },
  },
  {
    id: 'forceusa',
    name: 'Force USA',
    website: 'https://forceusa.com/',
    shipsToNl: false,
    affiliateProgram: {
      status: 'niet-aangesloten',
      network: null,
      note: 'Amerikaanse fabrikantpagina; Nederlandse verkrijgbaarheid en prijs niet gecontroleerd.',
    },
  },
];

export const supplierById = new Map(SUPPLIERS.map((s) => [s.id, s]));
