# Domeinkennis — SpuitLogger

Relatief stabiele kennis die zelden verandert. Doel: voorkomen dat een
sessie zonder geheugen opnieuw moet uitzoeken wat hier al vaststaat.
Bijwerken zodra iets hieronder structureel verandert — niet bij elke taak.

## Projectdoel

GIS-webapp voor bewoners om blootstelling aan bestrijdingsmiddelen/drift
vanaf agrarische percelen te registreren, met als doel juridisch
bruikbaar bewijsmateriaal (dossier) op te bouwen — geen
handhavingsinstrument, geen overheidstool.

## Kernconcepten

- **Melding** — één geregistreerde waarneming (`entries`-tabel). Heeft een
  `type`: `spuitactiviteit`, `drift`, `geur`, `gezondheid`, `geluid`, `overig`.
- **Perceel** — kadastraal perceel (PDOK), gekoppeld aan een melding via
  coördinaten, niet via een vaste FK (percelen worden live opgezocht).
- **Drift / driftzone** — afdrijving van spuitnevel; berekend uit
  windrichting/-snelheid op het moment van melden (`lib/drift/`). Een
  driftzone is een visuele kegel op de kaart, geen aparte databasetabel.
- **Cluster** — groepering van meldingen op kaart/tijdlijn op basis van
  nabijheid (OpenLayers `ol/source/Cluster`), puur presentatie, geen
  opgeslagen entiteit.
- **Dossier** — PDF-export van (een selectie) meldingen, inclusief
  kaartweergave, weerdata en SHA-256/RFC3161-tijdstempel
  (`lib/export/pdf.js`).
- **Buurtmelding / buurtdossier** — melding die de melder bewust deelt met
  omwonenden (`opt_in_buurt`), zichtbaar binnen een harde 5 km-straal
  vanaf de thuislocatie van de lezer (zie DECISIONS.md).

## Juridische context

- Bewijslast ligt bij de melder; dossier moet zelfstandig overtuigend zijn
  (tijd, locatie, weer, foto's optioneel).
- Tijdsregistratie via RFC 3161-tijdstempel + SHA-256-hash van het
  dossier — bedoeld om manipulatie achteraf aantoonbaar te maken.
- Geolocatie wordt vastgelegd via GPS van de melder, niet alleen adres.
- Herleidbaarheid naar de melder wordt bewust beperkt (zie Privacy).

## Privacy

- Meldingen worden in gedeelde/buurt-context pseudoniem getoond:
  `melderCode(email)` (`src/utils/format.js`) genereert een deterministische
  `Melder#XXXXXX`-code, geen e-mailadres in de UI.
- Admins (rol `'admin'`) hebben via RLS-policies (`supabase/migrations/0004`)
  volledige leestoegang tot alle meldingen/profielen — bypass van de
  normale eigenaar/opt-in-beperking.
- Publiek (niet-ingelogd of zonder opt-in) ziet geen meldingen van anderen.
- Onderzoeksdata-opt-out bestaat (`user_profiles.onderzoek_opt_out`,
  migratie 0008) — gebruiker kan zich uitsluiten van anonieme
  onderzoeksanalyse, default: meedoen (opt-out-model).

## GIS

- Kaart-engine: **OpenLayers 10** (niet Leaflet, niet MapLibre — zie
  DECISIONS.md voor de migratie-geschiedenis).
- Kaartlagen op het Dashboard (`DashboardKaart.jsx`): luchtfoto-toggle,
  driftzone-laag, Natura2000 (WFS-polygonen + infopopup bij klik),
  kadastrale percelen (WFS-polygonen + infopopup bij klik — popup
  toegevoegd 2026-06-21), clustermarkers, Heatmap (alternatief voor
  clustermarkers, **alleen zichtbaar voor rol `admin`/`coordinator`**).
- Kaart op de Melding-pagina (`LocatieKaart.jsx`): plaatsbare meldingspin,
  live GPS-positie van de melder, windvector-animatie, meetlint, en de
  kadastrale percelenlaag (hier **altijd zichtbaar**, geen toggle — anders
  dan op het Dashboard).
- Geen heatmap/percelen-toggle op de Melding-pagina: percelen tonen daar
  is informatief tijdens het melden, geen analyse-tool.

## Weerdata — drie gescheiden bronnen, niet één

Dit is een veelvoorkomende verwarring, dus expliciet uitgeschreven:

1. **Open-Meteo** (`lib/weather/openMeteo.js`) — live actuele wind/neerslag
   bij het **invullen van een melding**, voor de spuitrichtlijn-beoordeling
   (`lib/drift/oordeel.js`). Geen API-key nodig.
2. **KNMI Open Data EDR** (`lib/weather/knmi.js`) — gecertificeerde
   station-historie, met door de gebruiker zelf ingevoerde API-key
   (`KNMIInstellingen.jsx`). Gebruikt voor achteraf-opzoeken van officiële
   weerdata bij een melding (export/buurtrapport), niet voor live invoer.
3. **Buienradar** — was de bron voor de Dashboard-"Neerslagradar"
   (radarbeelden + neerslagverwachting + spuitvenster-indicatie). **Op
   2026-06-21 volledig verwijderd** op verzoek van de gebruiker, inclusief
   `lib/weather/radarLaag.js`, `weerbericht.js`, `spuitvenster.js`. Zie
   CURRENT_STATE.md.

`lib/weather/pasquill.js` (Pasquill-stabiliteitsklasse-berekening) wordt
gebruikt door de live spuitrichtlijn-beoordeling (#1): zowel als label in
de melding-UI, als analytisch in `lib/meldingen/spuitpatroon.js`
(`analyseerSpuitpatroon()`) — stabiele klasse E/F triggert een
blootstellingsindicator in het omstandighedenregister.

## Rollenmodel — wat de code daadwerkelijk doet

`user_roles.role` heeft een **CHECK-constraint** (migratie 0026) die
toegestane waarden afdwingt. Bevestigde, daadwerkelijk gecontroleerde
waarden in code (`src/lib/rollen.js`):

- `'gebruiker'` — default, ook wanneer er geen rij in `user_roles` bestaat
  of de rol-lookup faalt.
- `'admin'` — volledige toegang (RLS-bypass + CoördinatiePage +
  Heatmap-toggle + Prullenbak-herstel + buurtgebied-export).
- `'coordinator'` — **sinds 2026-06-21** gelijkgesteld aan `admin` voor:
  CoördinatiePage-toegang, Heatmap-toggle, en de RLS-policies op entries/
  user_profiles/buurtdossiers (migratie 0011). **Niet** gelijkgesteld aan
  admin voor: Prullenbak-herstel en buurtgebied-CSV/Dossier-PDF-export
  (die zijn admin-only, zie DECISIONS.md). Er is nog geen account met de
  rol `'coordinator'` aangemaakt — zie NEXT_STEPS.md.

Er bestaan **geen** rollen `moderator`, `beheerder` of `onderzoeker` in de
code op dit moment — als die ooit nodig zijn, is dat een nieuwe
beslissing, niet iets dat al bestaat.
