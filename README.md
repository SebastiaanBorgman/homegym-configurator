# Homegym Studio — 3D-homegymconfigurator (prototype)

Webapplicatie waarmee je je eigen homegym ontwerpt: ruimte invoeren, echte fitnessapparatuur op ware grootte plaatsen in 3D, ruimtecontrole, doorlopend prijsoverzicht en een besteloverzicht met links naar de leveranciers.

"Homegym Studio" is een tijdelijke, neutrale merknaam. Hij staat op één plek: `src/config/brand.ts`.

## Starten

Vereist: Node.js 20 of nieuwer.

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:5173
```

| Commando | Doet |
| --- | --- |
| `npm run dev` | Ontwikkelserver met live herladen |
| `npm run build` | Typecontrole + productiebuild in `dist/` |
| `npm run preview` | Serveert de productiebuild op http://localhost:4173 |
| `npm test` | 72 unit-tests (geometrie, ruimtecontrole, prijzen, import/export, generator, catalogus, 3D-modelmaten) |
| `npm run test:e2e` | Bouwt en draait 18 browsertests tegen de productiebuild; schermafbeeldingen in `test-results/screenshots/` |
| `npm run capture` | Maakt de voorbeeldafbeeldingen voor de homepage opnieuw (`public/examples/`) |
| `npm run explore` | Verkennende browserrun met schermafbeeldingen van alle schermen, ook mobiel en tablet |

De browsertests gebruiken de Chrome die al op de computer staat (`channel: 'chrome'`); er wordt geen testbrowser gedownload.

## Wat er in zit

- **Homepage** met een live, ronddraaiende 3D-voorbeeldgym, uitleg, drie voorbeeldontwerpen en een voettekst.
- **3D-configurator** (React Three Fiber): ruimte met vloer, muren, deuren, ramen en obstakels; apparaten toevoegen, selecteren, slepen (muis en touch), draaien (knoppen, sneltoetsen, draaigreep), dupliceren, verwijderen, tegen een muur zetten; magnetisch uitlijnen op muren, apparaten en raster; muren die het zicht blokkeren verdwijnen vanzelf.
- **Camera**: draaien, zoomen, schuiven; standen Standaard, Boven, Laag en Binnen (ooghoogte).
- **2D-plattegrond** op dezelfde gegevens, ook met slepen.
- **Ruimtecontrole** op echte geometrie: door een muur, te hoog voor het plafond, overlap (ook gedraaid), obstakels, geblokkeerde deur, beperkte gebruiksruimte.
- **Catalogus** met 25 producten in 10 categorieën, zoeken, filteren en een detailvenster met maten, bron en controledatum.
- **Bestellijst** met aantallen, regel- en totaalprijs, plus een afdrukbaar **besteloverzicht** per leverancier.
- **Bewaren**: automatisch lokaal opslaan, herstel na verversen, nieuw ontwerp, export/import als JSON, afbeelding (PNG) van 3D of 2D, ongedaan maken/opnieuw.
- **Genereer een indeling**: vier profielen; houdt rekening met maten, muren, plafond, deuren, obstakels en gebruiksruimte.

Sneltoetsen: `R` / `Shift+R` 90° draaien · `Q` / `E` 15° · `W` tegen de dichtstbijzijnde muur · pijltjes 1 cm (met `Shift` 10 cm) · `Ctrl+D` dupliceren · `Delete` verwijderen · `Ctrl+Z` / `Ctrl+Y` · `Home` standaardcamera · `Alt` tijdens slepen: tijdelijk niet uitlijnen · `Shift` aan de draaigreep: vrij draaien.

## Opbouw

```
src/domain/       Pure logica zonder React of three.js
  types.ts          Datamodel + vastgelegde eenheden en assen (meters, graden)
  geometry/         Vormen, overlap (SAT), ruimtecontrole, magnetisch uitlijnen, plaatsing
  layout/           Indelingsgenerator
  pricing.ts        Bestellijst en totalen (in eurocenten)
  storage/          Import/export (JSON) en lokale opslag
src/catalog/      Productgegevens, leveranciers, botsingsvormen — alleen data
src/models/       Procedurele 3D-modellen (three.js), los van React
src/scene/        3D-weergave: ruimte, apparaten, camera, bediening, labels, miniaturen
src/state/        Centrale ontwerp-store (zustand) met undo/redo en automatisch opslaan
src/configurator/ Interface van de configurator, incl. 2D-plattegrond
src/pages/        Homepage en besteloverzicht
e2e/              Browsertests (Playwright)
```

Eén bron van waarheid: 3D, 2D, ruimtecontrole en bestellijst lezen allemaal `state/designStore.ts`.

**Assen en eenheden.** Alles in meters en graden. Oorsprong in de hoek achterwand/linkerwand op de vloer; x = breedte, z = lengte, y = hoogte. Een apparaat heeft `width` (x), `depth` (z) en `height` (y); de positie is het midden van de voetafdruk; lokale +z is de voorzijde. Rotatie is tegen de klok in, van bovenaf gezien.

**Een product toevoegen.** Voeg een object toe aan `src/catalog/products.ts` (maten in meters, bron, controledatum, status, leverancierslink) en kies een bestaand `model.kind`. De test `catalog.test.ts` bevat een onafhankelijke brontabel in centimeters; vul die ook aan, dan bewaakt de test tikfouten.

**Affiliate.** Het datamodel is voorbereid (`Offer.affiliate`, `Supplier.affiliateProgram`, centrale functie `outboundUrl()` in `src/catalog/index.ts`). Er zijn geen trackingcodes: alle links zijn gewone links naar de productpagina.

## Productgegevens en bronnen

Alle gegevens zijn gecontroleerd op **10 november 2026**. Per product staan in de catalogus: de letterlijke maatopgave uit de bron, de bronlink, welke maat bij welke richting hoort, wat er gemeten is, de controledatum en de status.

| Status | Aantal | Producten |
| --- | --- | --- |
| Geverifieerd | 18 | Rogue RML-390F, Adjustable Bench 3.0, Universal Storage System 2.0, Echo Bike V3.0, Flat Pack Games Box · Tunturi PR60, HR60, UB100, hex-dumbbellset + rek, Dumbbell Tower, hex-dumbbellrek, Platinum Functional Trainer, HG60, WT85, Cardio Fit T60, Cardio Fit C30, kettlebell 16 kg · Concept2 SkiErg met vloerstandaard |
| Deels geverifieerd | 3 | Concept2 RowErg en BikeErg (lengte en breedte geverifieerd; Concept2 publiceert geen totale hoogte, die is indicatief) · Rogue Ohio Bar (lengte geverifieerd; mouwdiameter staat niet op de pagina, standaardmaat van circa 5 cm aangehouden) |
| Afgeleid | 2 | Rogue Echo Bumper Set 100 kg en 150 kg: stapelhoogte berekend uit de geverifieerde dikte per schijf |
| Niet geverifieerd | 2 | BowFlex SelectTech 552i en Force USA G3: de bronpagina's weigerden geautomatiseerd uitlezen; de maten komen uit zoekresultaten en dienen alleen ter demonstratie. Geen europrijs opgenomen. |

Bronnen: productpagina's van Rogue Fitness (`roguefitness.com/nl/en`), Tunturi (`tunturi.com/nl` en `/en`) en Concept2 (`concept2.nl`, `concept2.com`).

Verschillen tussen bronnen die bij het product zijn vermeld:
- Tunturi Cardio Fit T60: dezelfde pagina noemt 80,6 cm en 83,5 cm breed; de grootste waarde is aangehouden.
- Concept2 SkiErg met vloerstandaard: de Nederlandse pagina noemt 61 × 132 × 216 cm, de Amerikaanse pagina en Rogue 23,5" × 50" × 85". De hoogte is overal 216 cm.

Niet gelukt tijdens het onderzoek: Tunturi HG80 (retailers spreken elkaar tegen over 213 of 223 cm en de fabrikantpagina bestaat niet meer; vervangen door de HG60), producten van fitshop.nl, Gorilla Sports en VirtuFit (pagina's niet uit te lezen).

**Prijzen** zijn momentopnamen inclusief btw van de controledatum en dus indicatief; actieprijzen staan met de reguliere prijs erbij. **Gebruiksruimte** is alleen bij de Concept2 RowErg en BikeErg een opgave van de fabrikant; bij alle andere producten is het een eigen indicatie en zo aangeduid.

## 3D-modellen

Alle 22 modeltypes zijn zelfgebouwde, **vereenvoudigde reconstructies** uit geometrische vormen (`src/models/builders.ts`). Het zijn geen replica's en er zijn geen modellen of foto's van derden gebruikt; ook de productafbeeldingen in de catalogus zijn renders van deze modellen. De buitenmaten komen exact overeen met de catalogus. Open toestellen (racks, het alles-in-één station) hebben een botsingsvorm van losse balken, zodat een bank ín een rek geen overlap geeft.

## Wat is getest

**Unit-tests (72, geslaagd)** — `npm test`
- rotatie en coördinaten, overlap bij gedraaide apparaten, buiten de muren, plafondhoogte, obstakels, deurzone, gebruiksruimte;
- bank in een open rek geeft geen overlap, tegen een staander wel;
- prijzen in centen, aantallen, producten zonder prijs;
- export → import behoudt maten, posities en rotaties; kapotte bestanden worden afgewezen;
- de generator levert voor elke voorbeeldruimte en elk profiel een indeling zonder fouten of waarschuwingen;
- catalogusmaten komen overeen met de brontabel; elk 3D-model heeft exact de productmaten (afwijking < 1 mm), ook na draaien.

**Browsertests (18, geslaagd)** — `npm run test:e2e`, tegen de productiebuild in Chrome met echte muis- en aanraakbewegingen. De tests lezen de werkelijke toestand terug, inclusief de maten van wat er in 3D getekend is.

| # | Controle | Resultaat |
| --- | --- | --- |
| 1 | Ruimte 4 × 6 × 2,6 m op ware grootte; aanpassen werkt | geslaagd |
| 2 | Alle 25 producten staan met exact de catalogusmaten in 3D | geslaagd |
| 3 | Selecteren, slepen en draaien (toets, knop, draaigreep); camera blijft stil | geslaagd |
| 4 | Gedraaide apparaten behouden hun maten (90° en 30°) | geslaagd |
| 5 | Door een muur: foutmelding; vlak bij de muur klikt het apparaat vast | geslaagd |
| 6 | Overlap herkend, ook bij 45° gedraaide apparaten; raken is geen overlap | geslaagd |
| 7 | Te hoog voor het plafond herkend | geslaagd |
| 8 | Camera: draaien, zoomen, schuiven, boven, laag, binnen, terug naar standaard | geslaagd |
| 9 | Toevoegen via plusknop en detailvenster; zoeken en filteren | geslaagd |
| 10 | Totaalprijs, aantallen, regeltotalen, verwijderen, product zonder prijs | geslaagd |
| 11 | Ontwerp blijft bewaard na verversen | geslaagd |
| 12 | Export → nieuw ontwerp → import herstelt alles; ongeldig bestand geweigerd | geslaagd |
| 13 | Productiebuild: homepage, configurator, voorbeeld openen, besteloverzicht, 404 | geslaagd |
| 14 | 3D-beeld is gevuld; geen fouten in de browserconsole (geldt voor alle tests) | geslaagd |
| + | Generator met obstakel: geen fouten of waarschuwingen; daarna aanpasbaar | geslaagd |
| + | 2D en 3D tonen hetzelfde; slepen in 2D verplaatst ook in 3D | geslaagd |
| + | Obstakel-overlap, deurwaarschuwing, afbeelding exporteren (PNG) | geslaagd |
| + | Touch: één vinger op een apparaat sleept het; op een lege plek draait de camera | geslaagd |
| + | Sneltoetsen (draaien, schuiven, dupliceren, ongedaan maken, tegen de muur), type ruimte kiezen, afbeelding vanuit de plattegrond | geslaagd |

Daarnaast zijn schermafbeeldingen van alle schermen bekeken op 1440 px, 1024 px en 390 px.

## Niet getest en bekende beperkingen

- **Alleen Chrome op Windows** is getest. Firefox, Safari en echte telefoons of tablets niet; touch is getest met nagebootste aanraakgebeurtenissen (één vinger). Zoomen met twee vingers is niet getest.
- **Prestaties** zijn niet gemeten op een trage laptop. De test met 25 producten tegelijk draaide vlot op een pc met losse grafische kaart. De weergave tekent alleen opnieuw als er iets verandert.
- **Schuine daken** (zolders) worden niet ondersteund; alleen rechthoekige ruimtes met een vlak plafond.
- **Eén ontwerp tegelijk** in de browser; meerdere ontwerpen bewaar je via JSON-export.
- Apparaten staan op de vloer. Alleen losse accessoires (stang, schijven, dumbbells, kettlebell) kun je via een getalveld op hoogte zetten, bijvoorbeeld een stang op de J-cups. Wandmontage is er niet.
- De plyobox staat alleen in de laagste stand (50,8 cm); de bank alleen vlak.
- De ruimtecontrole is geen veiligheidskeuring. Indicatieve gebruiksruimtes zijn eigen vuistregels.
- De generator is regelgebaseerd en geeft een suggestie, geen optimale indeling. Apparaten die nergens met voldoende vrije ruimte passen, slaat hij over en meldt hij.
- De realisatiedienst (vloeren, schilderwerk, elektra, verlichting, airco) is alleen aangekondigd op de homepage en niet gebouwd. Er is geen kassa, account of backend.
