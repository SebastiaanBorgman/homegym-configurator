import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Box,
  Euro,
  Hammer,
  Lightbulb,
  ListChecks,
  Map,
  MousePointer2,
  Paintbrush,
  Ruler,
  Save,
  ShieldAlert,
  ShoppingCart,
  Sigma,
  WandSparkles,
  Wind,
  Zap,
} from 'lucide-react';
import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { PRODUCTS, SUPPLIERS } from '../catalog';
import { BRAND } from '../config/brand';
import { EXAMPLES, HERO_EXAMPLE, buildExample, type BuiltExample } from '../data/examples';
import { newId } from '../domain/id';
import { formatEuroCompact } from '../domain/pricing';
import { classNames, formatArea } from '../lib/format';
import { useDesignStore } from '../state/designStore';
import { toast } from '../state/uiStore';
import { buttonClass } from '../ui/primitives';
import { Logo } from '../ui/Logo';

const GymScene = lazy(() => import('../scene/GymScene'));

const verifiedCount = PRODUCTS.filter((p) => p.dimensionInfo.status === 'verified').length;
const partialCount = PRODUCTS.filter((p) => p.dimensionInfo.status === 'partial').length;
const derivedCount = PRODUCTS.filter((p) => p.dimensionInfo.status === 'derived').length;
const unverifiedCount = PRODUCTS.filter((p) => p.dimensionInfo.status === 'unverified').length;

/** Bouwt de voorbeelden pas na de eerste weergave op, zodat de pagina direct zichtbaar is. */
function useExamples() {
  const [hero, setHero] = useState<BuiltExample | null>(null);
  const [examples, setExamples] = useState<BuiltExample[] | null>(null);
  useEffect(() => {
    const t1 = setTimeout(() => setHero(buildExample(HERO_EXAMPLE)), 30);
    const t2 = setTimeout(() => setExamples(EXAMPLES.map(buildExample)), 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return { hero, examples };
}

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, inView };
}

function HeroScene({ hero }: { hero: BuiltExample | null }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="relative aspect-[4/3.4] w-full sm:aspect-[4/3] lg:aspect-auto lg:h-[620px]" data-testid="hero-scene">
      <div className="absolute inset-0 animate-fade">
        {hero && (
          <Suspense fallback={null}>
            <GymScene design={hero.design} interactive={false} autoRotate paused={!inView} />
          </Suspense>
        )}
      </div>
      {!hero && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="size-10 animate-spin rounded-full border-[3px] border-white/15 border-t-volt" />
        </div>
      )}
      {hero && (
        <>
          <div className="pointer-events-none absolute left-2 top-6 animate-rise rounded-2xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 backdrop-blur-md sm:left-6">
            <p className="tabular text-sm font-bold text-white">4,00 × 6,00 × 2,60 m</p>
            <p className="text-[11px] text-ink-300">{formatArea(24)} · voorbeeldruimte</p>
          </div>
          <div className="pointer-events-none absolute bottom-8 right-2 animate-rise rounded-2xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 backdrop-blur-md [animation-delay:150ms] sm:right-6">
            <p className="tabular text-sm font-bold text-volt">{formatEuroCompact(hero.totalCents)}</p>
            <p className="text-[11px] text-ink-300">{hero.itemCount} producten · indicatief</p>
          </div>
          <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 text-[11px] font-medium text-ink-400 sm:flex">
            <MousePointer2 size={12} /> Sleep om rond te kijken
          </p>
        </>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li className="relative rounded-3xl border border-sand-200 bg-white p-6 shadow-card">
      <span className="display text-5xl text-sand-300">{n}</span>
      <h3 className="display mt-4 text-xl text-ink-900">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{children}</p>
    </li>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-volt">{icon}</span>
      <div>
        <h3 className="text-base font-bold text-ink-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">{children}</p>
      </div>
    </li>
  );
}

function ExampleCard({ example, onOpen }: { example: BuiltExample; onOpen: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { def, design } = example;
  return (
    <li className="group flex flex-col overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-card transition hover:-translate-y-1 hover:shadow-float" data-testid={`example-${def.id}`}>
      <div className="viewport-backdrop relative aspect-[4/3] overflow-hidden">
        {!imageFailed ? (
          <img
            src={`${import.meta.env.BASE_URL}examples/${def.id}.jpg`}
            alt={`3D-weergave van ${def.title.toLowerCase()}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-ink-400">
            <Box size={36} />
            <span className="text-xs font-medium">Open het ontwerp om het in 3D te bekijken</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-ink-900/85 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">{def.kicker}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="display text-xl text-ink-900">{def.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{def.description}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-sand-200 pt-4 text-center">
          <div>
            <dt className="text-[11px] font-medium text-ink-400">Oppervlak</dt>
            <dd className="tabular text-sm font-bold text-ink-900">{formatArea(design.room.width * design.room.length)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-ink-400">Producten</dt>
            <dd className="tabular text-sm font-bold text-ink-900">{example.itemCount}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-ink-400">Indicatie</dt>
            <dd className="tabular text-sm font-bold text-ink-900">{formatEuroCompact(example.totalCents)}</dd>
          </div>
        </dl>
        <button type="button" onClick={onOpen} className={classNames(buttonClass('dark', 'md', true), 'mt-4')} data-testid={`open-example-${def.id}`}>
          Open en pas aan <ArrowRight size={16} />
        </button>
      </div>
    </li>
  );
}

const NAV = [
  { href: '#zo-werkt-het', label: 'Zo werkt het' },
  { href: '#echte-maten', label: 'Echte maten' },
  { href: '#voorbeelden', label: 'Voorbeelden' },
  { href: '#realisatie', label: 'Realisatie' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { hero, examples } = useExamples();
  const hasSavedWork = useDesignStore((s) => s.design.items.length > 0);

  useEffect(() => {
    document.title = `${BRAND.name} — ${BRAND.tagline}`;
  }, []);

  const openExample = (example: BuiltExample) => {
    const design = { ...example.design, id: newId('ontwerp'), items: example.design.items.map((i) => ({ ...i, id: newId('item') })) };
    useDesignStore.getState().loadDesign(design);
    if (hasSavedWork) toast('info', `"${example.def.title}" geopend`, 'Je vorige ontwerp haal je terug met Ongedaan maken (Ctrl+Z).');
    navigate('/configurator');
  };

  return (
    <div className="bg-sand-50 text-ink-900">
      {/* ─────────────── Hero ─────────────── */}
      <div className="hero-backdrop relative overflow-hidden text-white">
        <div className="grid-lines pointer-events-none absolute inset-0" aria-hidden />
        <header className="relative z-10 mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" aria-label={`${BRAND.name} — home`} className="rounded-lg">
            <Logo tone="dark" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-200 lg:flex" aria-label="Hoofdnavigatie">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="transition hover:text-white">
                {n.label}
              </a>
            ))}
          </nav>
          <Link to="/configurator" className={buttonClass('primary', 'md')} data-testid="nav-cta">
            <span className="hidden sm:inline">Start met ontwerpen</span>
            <span className="sm:hidden">Start</span>
            <ArrowRight size={16} />
          </Link>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-4 px-5 pb-10 pt-8 sm:px-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] lg:gap-6 lg:pb-6 lg:pt-4">
          <div className="animate-rise">
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-volt">
              <Box size={13} /> 3D-homegymconfigurator
            </p>
            <h1 className="display mt-6 text-[2.7rem] sm:text-6xl xl:text-7xl">
              Ontwerp je eigen homegym.
              <span className="mt-2 block text-volt">Tot op de centimeter.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">{BRAND.description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/configurator" className={buttonClass('primary', 'lg')} data-testid="hero-cta">
                Ontwerp je eigen homegym <ArrowRight size={19} />
              </Link>
              <a href="#voorbeelden" className="inline-flex h-13 items-center gap-2 rounded-2xl border border-white/20 px-6 font-semibold text-white transition hover:bg-white/10">
                Bekijk voorbeelden
              </a>
            </div>
            {hasSavedWork && (
              <p className="mt-4 text-sm text-ink-300">
                Je hebt een bewaard ontwerp.{' '}
                <Link to="/configurator" className="font-semibold text-volt underline-offset-4 hover:underline" data-testid="resume-link">
                  Ga verder waar je was
                </Link>
              </p>
            )}
            <ul className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-white/10 pt-6 text-sm">
              <li>
                <span className="display tabular block text-2xl text-white">{PRODUCTS.length}</span>
                <span className="text-ink-300">echte producten</span>
              </li>
              <li>
                <span className="display tabular block text-2xl text-white">1 : 1</span>
                <span className="text-ink-300">op ware grootte</span>
              </li>
              <li>
                <span className="display block text-2xl text-white">Gratis</span>
                <span className="text-ink-300">zonder account</span>
              </li>
            </ul>
          </div>
          <HeroScene hero={hero} />
        </div>
      </div>

      {/* ─────────────── Zo werkt het ─────────────── */}
      <section id="zo-werkt-het" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8 lg:py-28">
        <p className="eyebrow text-ink-400">Zo werkt het</p>
        <h2 className="display mt-3 max-w-2xl text-4xl sm:text-5xl">Van lege ruimte naar bestellijst in drie stappen.</h2>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          <Step n="01" title="Vul je ruimte in">
            Breedte, lengte en hoogte van je garage, zolder, slaapkamer of bijgebouw. Voeg deuren, ramen en pilaren toe zodat het klopt met
            de werkelijkheid.
          </Step>
          <Step n="02" title="Plaats echte apparatuur">
            Kies racks, banken, gewichten en cardio uit de catalogus en sleep ze op hun plek. De configurator waarschuwt als iets niet past.
          </Step>
          <Step n="03" title="Bestel bij de leverancier">
            Je ziet doorlopend wat je gym kost. Ben je tevreden, dan krijg je een besteloverzicht met links naar de webshops.
          </Step>
        </ol>
      </section>

      {/* ─────────────── Echte maten ─────────────── */}
      <section id="echte-maten" className="scroll-mt-8 border-y border-sand-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[5fr_7fr] lg:py-28">
          <div>
            <p className="eyebrow text-ink-400">Echte maten</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">Wat je ziet, past ook echt.</h2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-500">
              Een rack dat 234,3 cm hoog is, staat ook als 234,3 cm in je ruimte. Bij elk product staat waar de maten vandaan komen, wanneer ze
              zijn gecontroleerd en hoe zeker we ervan zijn.
            </p>
            <dl className="mt-8 space-y-2.5" data-testid="status-legend">
              {[
                { icon: <BadgeCheck size={16} />, tone: 'bg-ok-soft text-ok', n: verifiedCount, label: 'geverifieerd', text: 'alle maten overgenomen van fabrikant of leverancier' },
                { icon: <Ruler size={16} />, tone: 'bg-warn-soft text-[#9a6200]', n: partialCount, label: 'deels geverifieerd', text: 'één maat is niet gepubliceerd en dus indicatief' },
                { icon: <Sigma size={16} />, tone: 'bg-info-soft text-info', n: derivedCount, label: 'afgeleid', text: 'berekend uit geverifieerde fabrikantmaten' },
                { icon: <ShieldAlert size={16} />, tone: 'bg-danger-soft text-danger', n: unverifiedCount, label: 'niet geverifieerd', text: 'duidelijk gemarkeerd, alleen ter demonstratie' },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 rounded-2xl border border-sand-200 px-4 py-3">
                  <span className={classNames('inline-flex size-9 shrink-0 items-center justify-center rounded-xl', row.tone)}>{row.icon}</span>
                  <dt className="tabular display w-8 text-2xl text-ink-900">{row.n}</dt>
                  <dd className="text-sm text-ink-500">
                    <span className="font-semibold text-ink-900">{row.label}</span> — {row.text}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <ul className="grid content-center gap-x-10 gap-y-9 sm:grid-cols-2">
            <Feature icon={<Ruler size={20} />} title="Maten met bronvermelding">
              Per product de letterlijke opgave van de fabrikant, de bronlink en de controledatum.
            </Feature>
            <Feature icon={<ListChecks size={20} />} title="Ruimtecontrole">
              Echte geometrie: door een muur, te hoog voor het plafond, overlap, obstakels en een geblokkeerde deur.
            </Feature>
            <Feature icon={<Euro size={20} />} title="Altijd zicht op je budget">
              De totaalprijs loopt mee met elk apparaat dat je plaatst of weghaalt.
            </Feature>
            <Feature icon={<WandSparkles size={20} />} title="Genereer een indeling">
              Laat een voorstel maken voor jouw ruimte en pas het daarna volledig zelf aan.
            </Feature>
            <Feature icon={<Map size={20} />} title="3D én plattegrond">
              Wissel tussen de 3D-ruimte en een 2D-bovenaanzicht; beide tonen exact hetzelfde ontwerp.
            </Feature>
            <Feature icon={<Save size={20} />} title="Bewaren zonder account">
              Je ontwerp blijft bewaard in je browser. Exporteer het als bestand om het te delen of later te openen.
            </Feature>
          </ul>
        </div>
      </section>

      {/* ─────────────── Voorbeelden ─────────────── */}
      <section id="voorbeelden" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-ink-400">Voorbeelden</p>
            <h2 className="display mt-3 max-w-2xl text-4xl sm:text-5xl">Begin met een voorbeeld en maak het van jou.</h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-500">
            Deze indelingen zijn gemaakt met de indelingsgenerator en doorgerekend met dezelfde ruimtecontrole als je eigen ontwerp.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-3" data-testid="examples">
          {examples
            ? examples.map((e) => <ExampleCard key={e.def.id} example={e} onOpen={() => openExample(e)} />)
            : EXAMPLES.map((e) => <li key={e.id} className="skeleton h-[480px] rounded-3xl" aria-hidden />)}
        </ul>
      </section>

      {/* ─────────────── Realisatie (toekomst) ─────────────── */}
      <section id="realisatie" className="scroll-mt-8 bg-ink-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="eyebrow inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-volt">In voorbereiding</p>
            <h2 className="display mt-5 text-4xl sm:text-5xl">Straks bouwen we je homegym ook.</h2>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-200">
              Het plan: van ontwerp tot oplevering door één partij. Deze dienst is nog niet beschikbaar; je kunt hem hier dus ook nog niet
              aanvragen. De configurator en de bestellijst werken nu al volledig.
            </p>
          </div>
          <ul className="grid content-center gap-3 sm:grid-cols-2">
            {[
              { icon: <Box size={18} />, label: 'Sportvloeren' },
              { icon: <Paintbrush size={18} />, label: 'Schilderwerk en wandafwerking' },
              { icon: <Hammer size={18} />, label: 'Verlaagde plafonds' },
              { icon: <Zap size={18} />, label: 'Elektra' },
              { icon: <Lightbulb size={18} />, label: 'Verlichting' },
              { icon: <Wind size={18} />, label: 'Airconditioning' },
            ].map((s) => (
              <li key={s.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-medium text-ink-100">
                <span className="text-volt">{s.icon}</span>
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─────────────── Eerlijk over dit prototype ─────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <p className="eyebrow text-ink-400">Goed om te weten</p>
        <h2 className="display mt-3 max-w-2xl text-3xl sm:text-4xl">Eerlijk over wat dit prototype wel en niet doet.</h2>
        <ul className="mt-10 grid gap-5 text-sm leading-relaxed text-ink-500 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-2xl border border-sand-200 bg-white p-5">
            <h3 className="mb-1.5 font-bold text-ink-900">Vereenvoudigde 3D-modellen</h3>
            De toestellen zijn zelf opgebouwde, herkenbare modellen op de juiste buitenmaten — geen exacte replica’s van het product.
          </li>
          <li className="rounded-2xl border border-sand-200 bg-white p-5">
            <h3 className="mb-1.5 font-bold text-ink-900">Indicatieve prijzen</h3>
            Prijzen zijn een momentopname met controledatum. De actuele prijs zie je bij de leverancier.
          </li>
          <li className="rounded-2xl border border-sand-200 bg-white p-5">
            <h3 className="mb-1.5 font-bold text-ink-900">Geen gezamenlijke kassa</h3>
            Je bestelt elk product bij de leverancier zelf, via de link in je besteloverzicht.
          </li>
          <li className="rounded-2xl border border-sand-200 bg-white p-5">
            <h3 className="mb-1.5 font-bold text-ink-900">Geen veiligheidskeuring</h3>
            De ruimtecontrole rekent met echte maten, maar vervangt de handleiding en het advies van de fabrikant niet.
          </li>
        </ul>
      </section>

      {/* ─────────────── Afsluitende oproep ─────────────── */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[2rem] bg-volt px-8 py-12 text-volt-ink sm:px-12 lg:flex-row lg:items-center">
          <div>
            <h2 className="display text-4xl sm:text-5xl">Zie het voor je. Op schaal.</h2>
            <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-volt-ink/80">Begin met een lege ruimte van 4 × 6 meter en pas alles aan naar jouw situatie.</p>
          </div>
          <Link to="/configurator" className={classNames(buttonClass('dark', 'lg'), 'shrink-0')} data-testid="footer-cta">
            Ontwerp je eigen homegym <ArrowRight size={19} />
          </Link>
        </div>
      </section>

      {/* ─────────────── Voettekst ─────────────── */}
      <footer className="bg-ink-950 text-ink-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Logo tone="dark" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              {BRAND.tagline}. Een prototype van een platform om homegyms te ontwerpen, samen te stellen en — op termijn — te laten realiseren.
            </p>
          </div>
          <div>
            <h3 className="eyebrow mb-4 text-white">Ontwerpen</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/configurator" className="hover:text-white">
                  3D-configurator
                </Link>
              </li>
              <li>
                <Link to="/bestellijst" className="inline-flex items-center gap-1.5 hover:text-white">
                  <ShoppingCart size={14} /> Besteloverzicht
                </Link>
              </li>
              <li>
                <a href="#voorbeelden" className="hover:text-white">
                  Voorbeelden
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="eyebrow mb-4 text-white">Leveranciers</h3>
            <ul className="space-y-2.5 text-sm">
              {SUPPLIERS.filter((s) => s.shipsToNl).map((s) => (
                <li key={s.id}>
                  <a href={s.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                    {s.name} <ArrowUpRight size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="eyebrow mb-4 text-white">Over de links</h3>
            <p className="text-sm leading-relaxed">
              Alle links naar webshops zijn op dit moment gewone links: we ontvangen geen commissie. Later kunnen dit affiliate-links worden;
              dat vermelden we dan duidelijk.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-5 py-5 text-xs leading-relaxed text-ink-400 sm:px-8">
            © {new Date().getFullYear()} {BRAND.name} — tijdelijke merknaam. Productnamen en merken zijn eigendom van hun fabrikanten en worden
            alleen ter aanduiding genoemd. Maten en prijzen onder voorbehoud; controleer ze bij de leverancier.
          </p>
        </div>
      </footer>
    </div>
  );
}
