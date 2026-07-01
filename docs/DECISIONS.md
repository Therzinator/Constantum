# Beslissingen — Constatum

Architectuur- en productbeslissingen, met de reden erbij. Geen taken hier
(zie NEXT_STEPS.md). Nieuwe beslissing toevoegen onderaan, oudste boven.

---

## OpenLayers als kaart-engine (niet Leaflet, niet MapLibre)

### Keuze
OpenLayers 10 (`ol` package) + `proj4` voor RD New (EPSG:28992)-reprojectie.

### Waarom
De oorspronkelijke prototype (`docs/index.html`) gebruikte Leaflet. Bij de
migratie naar React (commit `4abad98`) is overgestapt naar OpenLayers,
omdat dat WFS-laagondersteuning, clustering, heatmaps en CRS-reprojectie
(nodig voor PDOK-kadastrale-kaart, die in RD New levert) ingebouwd biedt
zonder externe plugins. MapLibre is niet overwogen in de geregistreerde
geschiedenis.

### Impact
Alle kaartcomponenten (`DashboardKaart.jsx`, `LocatieKaart.jsx`,
`MeldingMiniKaart.jsx`) en alle `lib/pdok/*Laag.js`/`lib/drift/*Laag.js`-
bestanden zijn OpenLayers-specifiek. Een toekomstige kaart-engine-wissel
raakt al deze bestanden.

---

## Weerdata gesplitst over drie bronnen, niet één gedeelde integratie

### Keuze
Open-Meteo (live, bij melding-invoer) + KNMI Open Data EDR (gecertificeerd,
op aanvraag met API-key) blijven gescheiden bronnen voor gescheiden
doelen.

### Waarom
Open-Meteo heeft geen key nodig en is snel genoeg voor live invoer, maar
is niet "officieel"/gecertificeerd genoeg voor een juridisch dossier.
KNMI Open Data is dat wel, maar vereist een door de gebruiker zelf
aangevraagde API-key en is te traag/zwaar voor live invoer. Vandaar twee
aparte modules in plaats van één met fallback.

### Impact
`lib/weather/openMeteo.js` en `lib/weather/knmi.js` blijven losse,
onafhankelijke modules. Een wijziging aan de ene mag de andere niet raken.
`knmi.js` heeft intern een Open-Meteo ERA5-fallback ingebouwd — dat is
niet hetzelfde als de live Open-Meteo aanroep in `openMeteo.js`, maar
een aparte historische-archief-aanroep voor het geval KNMI EDR
niet beschikbaar is. De twee modules delen geen code.

---

## Buienradar voor de Dashboard-"Neerslagradar" — en later: volledige verwijdering

### Keuze
Eerst (commit `04a09fc`, `4f1f2a7`): RainViewer-radarbeelden vervangen door
Buienradar's gratis raintext/feed-API, omdat RainViewer's gratis tier
sinds 1 januari 2026 geen nowcast meer levert en een lager max-zoomniveau
kreeg. Later, **op 2026-06-21**: de hele Neerslagradar-functionaliteit
(radaranimatie, neerslagverwachting, spuitvenster-indicatie) is op
expliciet verzoek van de gebruiker **volledig verwijderd** uit de app.

### Waarom
Eerste keuze: technische beperking van de gratis RainViewer-tier.
Verwijdering: productbeslissing van de gebruiker (niet technisch
gemotiveerd) — geen vervanging gepland op het moment van verwijderen.

### Impact
`lib/weather/radarLaag.js`, `weerbericht.js`, `spuitvenster.js` zijn
verwijderd. `lib/weather/pasquill.js` bleef bestaan (nog in gebruik door
de live spuitrichtlijn-beoordeling). Als neerslagradar ooit terugkomt: dit
is een **bewust verwijderde** feature, geen vergeten/kapotte code — niet
zomaar terugzetten vanuit git-historie zonder de gebruiker te vragen of
de wens nog steeds geldt.

---

## Supabase als backend, schema handmatig beheerd

### Keuze
Supabase (Postgres + Auth + Storage), zonder gekoppelde migratie-tooling.
Schema-wijzigingen worden wel als SQL-bestand vastgelegd in
`supabase/migrations/NNNN_korte_naam.sql`, maar handmatig uitgevoerd in de
Supabase SQL-editor — een agent voert dit nooit zelf uit.

### Waarom
Vastgelegd in root-CLAUDE.md; geen aanvullende reden in de geschiedenis
gevonden. Waarschijnlijk: kleinschalig project, voorkeur voor handmatige
controle over schema-wijzigingen i.p.v. geautomatiseerde rollouts.

### Impact
Geen enkele agent-actie mag een SQL-migratie automatisch uitvoeren. Elke
schema-wijziging = nieuw genummerd bestand + de gebruiker voert het zelf
uit. Er is geen canonieke `CREATE TABLE`-definitie van `user_roles` in de
migraties terug te vinden (die tabel bestond al vóór migratie 0001) — het
rolmodel is dus alleen af te leiden uit code-gebruik, niet uit schema.

---

## Pseudonieme weergave van meldingen bij delen

### Keuze
Bij gedeelde/buurt-meldingen wordt nooit het e-mailadres van de melder
getoond, alleen een deterministische `Melder#XXXXXX`-code
(`melderCode()` in `src/utils/format.js`).

### Waarom
Privacybescherming van de melder richting omwonenden/derden — voorkomt dat
een melder identificeerbaar wordt voor de partij waarover gemeld wordt.

### Impact
Elke UI die meldingen van *anderen* toont (Dashboard-kaart-legenda,
clustermarkers, Tijdlijn-buurtfilter) moet `melderCode()` gebruiken, nooit
het ruwe e-mailadres. Admins zien via een aparte RLS-bypass wel volledige
gegevens (zie migratie 0004).

---

## Hard 5 km-maximum op zichtbaarheid van gedeelde buurtmeldingen

### Keuze
Een lezer ziet nooit een `opt_in_buurt`-melding van iemand anders die
verder dan 5 km van de eigen thuislocatie ligt — afgedwongen op
database-niveau (RLS-policy, migratie 0009), niet alleen client-side.

### Waarom
Bug/privacylek: vóór migratie 0009 kon een teler die zelf een account
aanmaakt landelijk meekijken met alle gedeelde meldingen, puur door de
boolean `opt_in_buurt` te checken zonder afstandsgrens. De
client-instelling (Instellingen → Bereik, 1–5 km) kan deze 5 km-grens
alleen vernauwen, nooit verruimen.

### Impact
Een lezer zonder ingestelde thuislocatie ziet **geen** gedeelde
buurtmeldingen van anderen (fail-closed). Elke toekomstige
"deel met de buurt"-functionaliteit moet tegen deze policy aanlopen, niet
er omheen werken via een nieuwe client-only-filter.

---

## SHA-256/RFC 3161/eIDAS-logica is een freeze-zone

### Keuze
Geen agent wijzigt cryptografische/tijdstempel-logica zonder expliciete
bevestiging van de gebruiker (root-CLAUDE.md, regel 1).

### Waarom
Dit is de juridische kern van het dossier-bewijs — een onbedoelde
wijziging kan de bewijswaarde van bestaande/toekomstige dossiers
ondermijnen. Validatie hiervan vereist domeinkennis (eIDAS-conformiteit)
die niet door code-inspectie alleen te garanderen is.

### Impact
Elke taak die per ongeluk dicht bij `lib/export/pdf.js`,
tijdstempel-/hash-gerelateerde code komt: eerst expliciet navragen, niet
"meeliftend" aanpassen als onderdeel van een andere taak.

---

## Rol `coordinator` — moderator-achtige rol, uitgebreid naar CoördinatiePage + RLS

### Keuze
`isCoordinatorOfAdmin()` (`src/lib/rollen.js`) behandelt `'coordinator'`
gelijk aan `'admin'` voor: de Heatmap-toggle (Dashboard), de
"Coördinatie"-tab (BottomNav.jsx/App.jsx), én de onderliggende RLS-
policies (migratie 0011) voor entries (select+update), user_profiles
(select+update) en buurtdossiers. **Niet** uitgebreid naar: de
user_profiles DELETE-policy (account verwijderen, migratie 0008) en de
Prullenbak-herstelfunctie (InstellingenPage/PrullenbakCard) — die blijven
`'admin'`-only.

### Waarom
Eerste stap (2026-06-21, ochtend): "Hotspots... moet alleen zichtbaar
zijn voor coordinators en admins" — alleen de Heatmap-toggle gegated,
bewust niet doorgetrokken naar de rest, om geen ongevraagde
toegangswijziging te maken.
Tweede stap (2026-06-21, later): expliciet gevraagd om coordinator als
volwaardige "moderator-achtige rol op het platform" te maken. Scope is
samen met de gebruiker afgebakend: bekijken + zichtbaarheid modereren,
trust-score aanpassen, en datakwaliteit/rapportage-tools wél; Prullenbak-
herstel (destructiever, en zit niet eens op CoördinatiePage maar op
Instellingen) bewust niet.

### Impact
Een coordinator kan nu alles op CoördinatiePage wat een admin ook kan,
behalve geen toegang tot account-verwijdering (die endpoint wordt vanuit
CoördinatiePage toch niet aangeroepen) en geen Prullenbak-herstel. Nieuwe
admin-only functionaliteit die ooit aan CoördinatiePage wordt toegevoegd,
moet bewust gecontroleerd worden of die wel/niet ook voor coordinator mag
— niet automatisch meeliften omdat de pagina al openstaat.

---

## Dossier-hash/foto-mismatch: gelabeld, niet "opgelost" met een nieuwe hash

### Keuze
Het PDF-dossier (`lib/export/pdf.js`) toonde één SHA-256-hash per melding
naast de foto's, wat de indruk kon wekken dat die hash de foto verifieert.
In werkelijkheid is het een hash van de meldinggegevens (metadata), niet
van een foto. Losstaand bestond er al wél een per-foto SHA-256-hash van
het ORIGINEEL geüploade bestand (`f.hash`, berekend in
`useNieuweMeldingForm.js` vóór EXIF-stripping) — die werd nergens getoond.
Gekozen oplossing: (1) de bestaande per-foto-hash nu wél tonen, met een
duidelijk label dat hij bij het origineel hoort, vóór EXIF/GPS-verwijdering;
(2) de metadata-hash een preciezer label geven ("meldinggegevens" i.p.v.
ongespecificeerd "SHA-256 hash"); (3) de getoonde foto zelf is nu de
volledige EXIF-gestripte versie (die al in IndexedDB stond) i.p.v. de
extra-gecomprimeerde thumbnail, zodat de afbeelding tenminste de "echte"
opgeslagen versie is.

### Waarom
Root-CLAUDE.md verbiedt het aanraken van SHA-256/RFC3161-logica zonder
expliciete bevestiging. Een nieuwe hash toevoegen (bv. een hash van de
EXIF-gestripte versie, om een byte-identieke match met de getoonde foto te
forceren) zou nieuwe cryptografische logica zijn — bewust niet gedaan
zonder die bevestiging. De gekozen aanpak verandert geen enkele
hash-/tijdstempel-berekening, alleen welke (al bestaande) waarden getoond
worden en hoe ze gelabeld zijn — een eerlijkheids-/transparantiefix, geen
cryptografiewijziging.

### Impact
De dossier-export claimt niet langer impliciet een foto-verificatie die
hij niet kan onderbouwen. Een melder die het ORIGINELE bestand nog heeft
(bv. op de telefoon) kan dat zelf hashen en vergelijken met de per-foto-
hash in het dossier — dat werkt nu pas, omdat die hash nu zichtbaar is.
Een toekomstige sessie die alsnog een hash-van-de-dossierversie wil
toevoegen (voor een directe byte-match met de getoonde afbeelding) moet
dat expliciet met de gebruiker bespreken — dat raakt wél nieuwe
crypto-logica.

---

## App bevroor bij eerste echte login — echte oorzaak was een useAuth.js-bug, niet de Realtime-filter

### Keuze
Bij de eerste keer dat de gebruiker echt inlogde met Supabase-gegevens
(in plaats van de altijd-uitgeschakelde localhost-auth), bevroor de app
met een console vol herhaalde `[Realtime] Status: CLOSED`-regels. Eerste
diagnose: de op 2026-06-21 toegevoegde `filter`-optie op de
postgres_changes-listener in `useSupabaseSync.js` werd verondersteld
door Supabase geweigerd te worden, in een reconnect-lus — teruggedraaid
naar een ongefilterde listener. De freeze bleef echter bestaan, wat
toonde dat die eerste diagnose onvolledig was.

De echte oorzaak: `useAuth.js`'s `laadGebruikerRol` had een `|| user`-
fallback met `[user]` als dependency. `onAuthStateChange` roept
`setUser()` aan bij ÉLK auth-event (ook stille token-refreshes), met
elke keer een nieuwe object-referentie. Omdat de authInit-`useEffect`
(die `onAuthStateChange` abonneert) depend op `[laadGebruikerRol]`, en
`laadGebruikerRol` dus bij elke `setUser()`-aanroep een nieuwe identiteit
kreeg, voerde die effect zichzelf opnieuw uit: oude listener afmelden,
nieuwe aanmelden — wat zelf weer een event en dus weer `setUser()` kon
triggeren. Oneindige lus. De Realtime-`CLOSED`-spam was een symptoom:
`useSupabaseSync.js`'s eigen effect depend rechtstreeks op `user`, dus
die werd in dezelfde lus telkens mee afgebroken en herstart.

Fix: `laadGebruikerRol` verliest de `|| user`-fallback en de
`[user]`-dependency (elke aanroeper geeft de user al expliciet door) —
nu stabiel (`[]`), dus de authInit-effect draait nog maar één keer.

### Waarom
Dit bleef tot nu onopgemerkt omdat `useAuth.js`'s `onAuthStateChange`-pad
nooit echt liep: lokaal staat `SUPABASE_ENABLED` altijd op `false` (zie
`lib/supabase/client.js`), dus deze code is pas voor het eerst tegen een
echte, ingelogde sessie getest tijdens deze freeze.

### Impact
Een algemene les voor dit project: **elke `useCallback`/`useEffect`-
dependency die een Supabase-auth-gerelateerde waarde gebruikt, moet
expliciet beoordeeld worden op "kan dit veranderen door een event
waar de gebruiker niets van merkt (token-refresh, etc.)?"** — zo'n
verandering die een dependency-keten raakt is precies het patroon dat
hier tot een oneindige lus leidde. Toekomstige wijzigingen aan
`useAuth.js`/`useSupabaseSync.js` kunnen het beste tegen een echte
Supabase-sessie getest worden, niet (alleen) op localhost.

---

## Buurt-notificaties verwijderd + 30 minuten vertraging op andermans gedeelde meldingen

### Keuze
Op 2026-06-22, op expliciet verzoek van de gebruiker, **volledig verwijderd**:
de buurt-notificatiefunctie (browser-`Notification` + in-app banner bij een
nieuwe gedeelde melding van een ander, `useBuurtNotificaties.js`/
`NotificatieBanner.jsx`/`NotificatieInstellingen.jsx`). Het bijbehorende
bereik-instelling (1/2,5/5 km, `buurtMelding.js`) blijft bestaan — die regelt
nu alleen nog hoe ver andermans gedeelde meldingen op Dashboard/Tijdlijn
zichtbaar zijn, los van enige notificatie, instelbaar via het account-menu.

Daarnaast: andermans gedeelde meldingen (`opt_in_buurt`) worden pas
**30 minuten na het melden** zichtbaar op Dashboard (kaart + "Recente
meldingen") en Tijdlijn ("Gedeelde meldingen in jouw buurt") —
`magAndermansMeldingTonen()` in `lib/meldingen/buurtVertraging.js`, op basis
van `entries.created_at` (server-tijdstip, niet het door de melder zelf
invoerbare `timestamp_local`). Eigen meldingen blijven voor de melder zelf
altijd direct zichtbaar.

### Waarom
Realtime zichtbaarheid van een nieuwe melding (via notificatie of direct op
de kaart) kan de identiteit van de melder verraden aan een teler die zich —
mogelijk onder een valse naam — bij de buurt-groep heeft aangesloten: wie
net een melding deed, is dan onmiddellijk af te leiden uit timing. Een
vertraging van 30 minuten ontkoppelt het moment van melden van het moment
van zichtbaar worden, zonder de bewijswaarde van de melding zelf aan te
tasten (tijdstip/hash/RFC3161 blijven exact, alleen de zichtbaarheid voor
ánderen is vertraagd).

### Impact
- Admin/coordinator-zicht (CoordinatiePage, buurtgebied-export,
  buurtrapport) is **niet** aangepast — dat is al een vertrouwde rol met
  volledig zicht op individuele meldingen, los van het peer-to-peer
  buurt-delen waar deze vertraging op gericht is. (Zie wel de latere
  beslissing hieronder: de buurtgebied-export zelf is nadien alsnog
  admin-only gemaakt, om een andere reden.)
- `useSupabaseSync.js`'s realtime-listener riep voorheen een callback aan
  bij elke INSERT (voor de notificatie) — die parameter/aanroep is
  verwijderd; de listener triggert verder ongewijzigd een gedebouncede
  herlaad van alle meldingen.
- Een toekomstige wijziging aan deze vertraging (bv. instelbaar maken, of
  ook laten gelden voor de admin-export) moet bewust opnieuw afgewogen
  worden tegen dit dreigingsmodel.

---

## Buurtgebied-export (CSV/Dossier-PDF) admin-only, coordinator-rol verder ongewijzigd

### Keuze
Op 2026-06-22 besloten: de buurtgebied-CSV/Dossier-PDF-export in
`BuurtgebiedTekenaar.jsx` (CoordinatiePage) is **admin-only** gemaakt — een
coordinator ziet de kaart, kan het gebied nog tekenen en als GeoJSON
exporteren, maar de twee knoppen die individuele meldingen (incl. PII van
andere melders) bundelen zijn voor coordinator verborgen, met een
verwijzing naar de beheerder. De rest van de coordinator-rol (moderatie,
trust-score, postcode/gemeente-backfill, buurtrapport) is **niet**
aangepast.

### Waarom
De gebruiker wil dossier-aanvragen liever zelf afhandelen i.p.v. een
coordinator-sleutel (met toegang tot alle individuele meldingen) te geven
aan iemand zonder kennis van de app/data. Tegelijk is volledige verwijdering
van de coordinator-rol nu bewust **niet** gedaan: de gebruiker verwacht
voorlopig weinig tot geen gebruikers en wil eerst zien of de app aanslaat
voordat er in rol-infrastructuur geïnvesteerd of die afgebroken wordt — de
rol blijft dus dormant beschikbaar voor het geval moderatietaken ooit
gedelegeerd moeten worden.

### Impact
- `gebruikerRol` wordt nu doorgegeven: `App.jsx` → `CoordinatiePage` →
  `BuurtgebiedTekenaar.jsx` (stond voorheen nergens in die keten).
- `isAdmin()` (lib/rollen.js) bepaalt `magExporteren` in
  `BuurtgebiedTekenaar.jsx` — geen nieuwe rolcontrole-functie nodig.
- Geen RLS/migratie-wijziging: `haalAlleEntriesVoorExportAdmin()` blijft
  voor coordinator technisch toegankelijk (server-side), dit is alleen een
  UI-restrictie. Als dat ooit ook server-side afgedwongen moet worden, is
  dat een nieuwe, aparte beslissing.
- Een toekomstige keuze om de coordinator-rol volledig te verwijderen of
  juist actief te gaan gebruiken voor delegatie staat nog open — bewust
  geen besluit hierover genomen, alleen deze ene actie afgeschermd.

---

## Trust-score automatische op-/afschaling — concrete getallen vastgelegd (migratie 0014)

### Keuze
Op 2026-06-22 heeft de gebruiker de open punten uit het eerdere
trust-score-ontwerp (zie eerdere CURRENT_STATE.md-versie) met concrete
getallen bevestigd: +5 bij expliciet "✓ Goedkeuren" door een coordinator,
-30 bij een nieuwe, handmatige "🚫 Verbergen" (shadow)-actie, +5 per
kwartaal voor accounts >90 dagen zonder under_review/shadow-vlag, en de
shadow-drempel direct (zonder eerst te inventariseren wie dat raakt)
verlaagd van <40 naar <20. Uitgewerkt in
`supabase/migrations/0014_trust_score_op_afschaling.sql`.

### Waarom
-30 is bewust zwaarder dan de automatische -20/-15 (migratie 0005) omdat
een coordinator het hier expliciet beoordeelt, niet een heuristiek. De
shadow-drempel mag direct verlaagd worden omdat het effect voor bestaande
gebruikers in de 20-39-band een **verzachting** is (under_review i.p.v.
volledig shadow) — geen nieuwe beperking die eerst gevalideerd moest
worden.

### Impact
- `fn_entries_set_visibility()` (migratie 0003/0005) is herschreven naar
  tier-logica; 80-100 slaat de nieuw-account-checks nu over.
- Nieuwe AFTER UPDATE-trigger `fn_entries_visibility_score_effect()` op
  `entries.visibility` — een UPDATE is per definitie een mens-beoordeling
  (de BEFORE INSERT-trigger raakt nooit een UPDATE), dus geen apart
  "is dit automatisch of handmatig"-onderscheid nodig in de trigger zelf.
- CoordinatiePage.jsx kreeg een nieuwe "🚫 Verbergen"-knop — die bestond
  nog niet; zonder een manier om `shadow` handmatig te zetten was de
  -30-straf onbereikbaar.
- De kwartaalbonus heeft geen insert-moment om op te hangen — losse
  `fn_trust_score_kwartaalbonus()`-functie, scheduling (`pg_cron` of
  handmatig) is een aparte, door de gebruiker zelf te nemen
  Supabase-dashboard-actie.
- Migratie 0014 is later **vervangen en uitgebreid** door migraties
  0022/0023/0024 (trust-score tier-systeem compleet, actie-bonussen,
  verwijdering legacy-triggers) — alle drie uitgevoerd.

---

## Groepenfunctie — vervangt "Uitnodigen", bestaat náást de buurt-deling (migratie 0015)

### Keuze
Op 2026-06-23 is de eenvoudige "Uitnodigen"-deeltoken-flow
(`coordinatie_tokens`, `DeeltokenGenerator.jsx`/`UitnodigenMenu.jsx`,
migratie 0007) volledig vervangen door een volwaardige Groepenfunctie:
groepen met leden/rollen (`lid`/`beheerder`/`hoofdbeheerder`), eigen
uitnodigingen (link + QR, instelbaar aantal gebruikers/verlooptijd),
openbare groepen, en een melder-gestuurde keuze om een melding met
specifieke groep(en) te delen (`entries_groepen`, migratie 0015 —
**uitgevoerd**, net als migraties 0016, 0018, 0020, 0021). Twee expliciete keuzes daarbinnen,
bevestigd door de gebruiker vóór implementatie:
- Een melder kiest **per groep** welke meldingen hij deelt — geen
  automatisch alles-delen zodra je lid wordt.
- Groepen-deling staat **naast** de bestaande buurt-deling
  (`opt_in_buurt`/5km-straal/30-min-vertraging, zie eerdere beslissingen
  hierboven) — die blijft ongewijzigd bestaan, alleen de UI van "Recente
  meldingen" op het Dashboard is soberder gemaakt (alleen nog type/datum/
  algemene regio, zie hieronder).
- Trust-score binnen een groep hergebruikt het **bestaande, globale**
  `user_profiles.trust_score` (geen apart per-groep-veld) — de hoeveelheid
  detail die een lid van andermans gedeelde melding ziet binnen een groep
  is afhankelijk van het EIGEN trust-score-niveau van de kijker, via een
  nieuwe, configureerbare tier-indeling
  (`src/lib/groepen/trustZichtbaarheid.js`, hergebruikt dezelfde
  bandbreedtes als migratie 0014's `fn_entries_set_visibility()`).

### Waarom
De oude Uitnodigen-flow had geen concept van lidmaatschap of een
blijvende sociale structuur — alleen een los, anonieme-teaser-tonende
registratielink. De opdracht vroeg om een sociale-samenwerkingsfunctie
met rollen/uitnodigingen/openbare groepen, wat een wezenlijk andere
datamodel-vorm is (lidmaatschap + per-groep rechten) dan een
wegwerptoken. Het naast elkaar laten bestaan van groepen en de
bestaande buurt-deling voorkomt dat het al uitgebreid afgewogen
privacy-dreigingsmodel van de buurt-functie (zie de beslissingen
hierboven) overhoop gehaald wordt door een grote, ongevraagde
architectuurwissel.

### Impact
- `coordinatie_tokens`/`verbruik_coordinatie_token`/
  `publieke_buurt_telling` (migratie 0002/0007) zijn **niet** gedropt —
  de app roept ze alleen niet meer aan. Een agent voert nooit zelf een
  schema-wijziging uit; dat blijft zo.
- Nieuwe BottomNav-tab `groepen` (vervangt de header-knop "Uitnodigen" in
  `AppHeader.jsx`) → `GroepenPage.jsx`/`GroepPage.jsx`
  (`src/components/groepen/`), backend in `src/lib/groepen/`.
- "Recente meldingen" (Dashboard, `MeldingCard.jsx` compacte variant)
  toont nu alleen meldingstype/datum/algemene regio (gemeente/provincie)
  — gezondheidsklachten-badge, sync-status, windgegevens, mini-kaartje,
  omschrijving, melder-code en bestandsaantal zijn daar verwijderd. De
  niet-compacte/Tijdlijn-variant is ongewijzigd; dat detailniveau hoort nu
  bij groepsmeldingen (trust-tier-gated, zie hierboven).
- Nieuwe afhankelijkheid: `qrcode` (npm), voor de QR-code van een
  groepsuitnodiging.
- Toekomstige uitbreiding van de trust-tier-indeling (nieuwe niveaus
  tussen laag/gemiddeld/hoog) kan in `trustZichtbaarheid.js` zonder de
  aanroepende code aan te passen — bewust config-gebaseerd opgezet.

---

## Font-size-tokensysteem — alle tekst via `--font-size-*`-variabelen, geen losse hardcoded waarden meer

### Keuze
Op 2026-07-01 is een typografie-audit (`src/audit/typografie-audit-2026-07-01.md`)
uitgevoerd op mobiele leesbaarheid, met als resultaat een nieuw
`--font-size-xs`(12px)/`sm`(14px)/`base`(16px)/`md`(18px)/`lg`(20px)/
`xl`(24px)/`2xl`(32px)-tokensysteem in `theme.css`. Vrijwel alle
hardcoded `font-size`/`fontSize`-waarden onder 14px in `src/` zijn
vervangen door deze tokens, plus een `--text-muted`-contrastfix
(`#4a5d78` → `#77839c`, 2,9:1 → ~5,1:1) en een contrastfix voor de
trust-tier-badges (witte tekst → donker).

### Waarom
De app wordt primair buiten, op een telefoon, onder tijdsdruk gebruikt
(bewoner die een melding doet) — de norm hiervoor (WCAG 2.1 AA, Apple
HIG, Material 3, NNG) ligt hoger dan de destijds gekozen compacte
UI-waarden (vaak 9-11px). Bijna 4 op de 5 van alle font-size-declaraties
in de app zaten onder 14px.

### Impact
- **Nieuwe regel voor alle toekomstig werk**: font-sizes altijd via een
  `--font-size-*`-token instellen, nooit een los getal. Mono-metadata
  (hashes, timestamps, melder-codes, coördinaten) mag `--font-size-xs`
  zijn; tekst die de gebruiker actief moet lezen (labels, foutmeldingen,
  beschrijvingen, juridische tekst) minimaal `--font-size-sm`.
- Bewust behouden kleine uitzondering: het versie-/copyright-voetnootje
  in `JuridischModal.css` (`.juridisch-modal-footer`) — expliciet
  "kleine print", de contrastfix dekt dat al af.
- **`#00d4aa`(oude teal)-consolidatie naar `var(--accent)`
  bewust NIET gedaan** — zie de eigen beslissing hieronder
  ("Kaart-/drift-/grafiek-kleuren blijven los van het CSS-thema").

---

## Kaart-/drift-/grafiek-kleuren blijven los van het CSS-thema (`var(--accent)`)

### Keuze
Hardcoded kleurwaarden in kaart-markers, driftzone-/windanimatie en de
maandgrafiek (`DashboardKaart.jsx`, `LocatieKaart.jsx`/`.css`,
`BuurtgebiedTekenaar.jsx`, `lib/pdok/perceelLaag.js`,
`lib/drift/windAnimatieLaag.js`, `lib/drift/oordeel.js`,
`MaandGrafiek.jsx` — het oude teal `#00d4aa`, van vóór de latere
`--accent`-wijzigingen naar nylon-groen en daarna cyaan) worden **niet**
gesynchroniseerd met de huidige `var(--accent)` (theme.css, nu
`#04e6d9`). Dit is nu drie keer bevestigd: bij de eerdere
kleurwissels (`--accent`: teal → nylon-groen → cyaan, zie
`CURRENT_STATE.md` "Navigatie/thema-herontwerp") én opnieuw op
2026-07-01 (typografie-audit Prioriteit 3), toen de gebruiker expliciet
koos dit niet alsnog te consolideren.

### Waarom
Dit raakt kaart-/drift-/grafiek-render-logica (OpenLayers-stijlen,
Chart.js), niet alleen UI-tekst/CSS-thema — een bredere en risicovollere
wijziging dan de scope van een typografie- of thema-aanpassing. Zonder
een expliciete, aparte productbeslissing om deze kleuren mee te laten
lopen met het UI-accent, blijven ze bewust apart.

### Impact
Een toekomstige `--accent`-wijziging (thema-kleur) werkt **niet** door
in kaartmarkers/driftzone-kleuren/grafiek — die blijven het oude teal
tonen, tenzij een aparte, expliciete beslissing dit verandert. Niet
per ongeluk "meeliften" als onderdeel van een CSS-thema- of
typografietaak.

---

## Browser-favicon blijft het handgemaakte icoon, niet auto-gegenereerd uit `icon_large.png`

### Keuze
Bij het vernieuwen van de PWA/app-iconen (2026-07-01, uit
`src/assets/app-icon/icon_large.png` via `sharp`) is de browser-tab-
favicon (16px/32px) bewust **niet** meegenomen in de automatische
regeneratie. `index.html` verwijst naar de bestaande, met de hand
gemaakte `public/icons/icon_16px.png`/`icon_32px.png`.

### Waarom
`icon_large.png` is niet vierkant (621×664) en een automatische
contain-fit-crop op 16-32px gaf een duidelijk andere, minder leesbare
compositie dan het bestaande kleine icoon — op verzoek van de gebruiker
teruggedraaid nadat dit zichtbaar werd.

### Impact
Bij een toekomstige logo-wijziging: de favicon (`icon_16px.png`/
`icon_32px.png`) moet apart, met de hand of met een op kleine formaten
geoptimaliseerd proces bijgewerkt worden — niet automatisch meegenomen
door simpelweg `icon_large.png` opnieuw te downscalen. De overige
PWA-iconen (Apple touch-icons, Android 48-512px, maskable) volgen wél
gewoon `icon_large.png`.

---

## Eén Error Boundary in App.jsx om `<main>`, met terugval naar het inlogscherm

### Keuze
Op 2026-07-01 is `src/components/ui/ErrorBoundary.jsx` toegevoegd — de
eerste en enige Error Boundary in de app, om de pagina-inhoud (`<main>`,
App.jsx). Bij een onverwachte render-fout toont die een nette fallback en
schakelt automatisch terug naar Dashboard + het inlogscherm.

### Waarom
Een crash-bij-uitloggen in productie liet het hele scherm zwart worden:
zonder énige Error Boundary neemt React bij een onverwachte fout de HELE
boom weg, inclusief `AuthOverlay.jsx` (een los sibling-element, geen kind
van de crashende pagina-inhoud) — de gebruiker kwam dus nergens meer
terecht i.p.v. terug bij het inlogscherm. De exacte regel achter de
crash zelf kon niet met zekerheid herleid worden uit de geminificeerde
productie-stacktrace (`vite.config.js` heeft daarom nu `build.sourcemap:
true`) — deze boundary is dus zowel een gerichte fix als een generieke
vangnet-maatregel tegen een hele klasse van vergelijkbare fouten.

### Impact
- Nieuwe render-fouten ergens in `<main>` laten de rest van de app (header,
  navigatie, AuthOverlay) intact — de gebruiker kan altijd nog inloggen/
  navigeren, ook als één pagina crasht.
- De boundary krijgt `key={pagina}` (App.jsx) zodat een geslaagde
  her-navigatie de fout-status niet laat "vastplakken".
- Een toekomstige, structurele reden om de crash te reproduceren: test
  bewust tegen een echte, ingelogde Supabase-sessie (niet alleen
  `SUPABASE_ENABLED=false` lokaal) — zie ook de eerdere freeze-bij-
  eerste-login-beslissing hierboven, hetzelfde patroon van bugs die pas
  in productie zichtbaar worden.

---

## Groeps-varianten van MeldingCard/ClusterCard/MeldingDetailModal, niet hergebruikt

### Keuze
Voor de Dashboard-groepsfilter en de Groepen-Tijdlijn/clustering
(2026-07-01) zijn aparte componenten gebouwd — `GroepMeldingKaart.jsx`,
`GroepClusterKaart.jsx` (naast de al bestaande `GroepMeldingDetailModal.jsx`)
— i.p.v. de persoonlijke `MeldingCard.jsx`/`ClusterCard.jsx`/
`MeldingDetailModal.jsx` te hergebruiken met groepsdata.

### Waarom
Groepsmeldingen (via `haalMeldingenVoorGroep()`) zijn trust-tier-gated:
een lage-trust-kijker mag geen exacte locatie/omschrijving/melderinfo/
foto's zien (`lib/groepen/trustZichtbaarheid.js`). De persoonlijke
`MeldingCard`/`MeldingDetailModal` tonen ongeconditioneerd hash/RFC3161/
device/volledige omschrijving/exacte GPS — die rechtstreeks hergebruiken
voor groepsdata zou de hele trust-tier-gate omzeilen (een privacylek,
niet alleen een cosmetisch verschil). Vandaar altijd de lichtere,
`toon`-bewuste groepsvarianten, ook al betekent dat enige duplicatie met
de persoonlijke componenten.

### Impact
- Nieuwe/gewijzigde groepsfunctionaliteit die kaarten/detailweergaves
  toont, moet altijd via de `Groep*`-varianten en `toon` uit
  `trustZichtbaarheid.js` — nooit "even" `MeldingCard`/`MeldingDetailModal`
  hergebruiken omdat het sneller lijkt.
- `clusterMeldingen()` (lib/meldingen/clustering.js) zelf is wél
  hergebruikt (domein-neutraal, werkt op elk object met `.timestamp_local`/
  `.gps.lat/lng`/`.perceelnummer`) — de aanroeper (`GroepMeldingenLijst.jsx`)
  redigeert de invoer al vóór het clusteren, niet de clusterfunctie zelf.
- Dashboard's groepsfilter toont daarom bewust GEEN kaart (DashboardKaart/
  MeldingDetailModal zijn niet groepsveilig te hergebruiken zonder diezelfde
  fout te riskeren) — alleen stats + de hergebruikte `GroepMeldingenLijst`.
  Een eventuele kaartweergave voor groepen vereist een eigen, groepsveilige
  variant — zie NEXT_STEPS.md.

---

## Neutrale juridische terminologie (AV v2.0) — bewust alleen in AV + Handleiding, nog niet in de rest van de app

### Keuze
Op 2026-07-01 is de Algemene Voorwaarden bijgewerkt naar v2.0, aangeleverd
door de gebruiker, met generieke/neutrale kernbegrippen i.p.v. de
pesticide-/spuit-specifieke termen uit v1.1: **Melding → Waarneming**,
**Dossier → Logboek**, **Buurtdossier → Gebiedsdossier**, **Teler →
Betrokkene**. Op expliciet verzoek van de gebruiker is `HandleidingModal.jsx`
hierop aangepast om dezelfde terminologie te gebruiken. De rest van de
app (UI-labels op Tijdlijn/Dashboard/Export/Groepen-pagina's,
`MeldingForm.jsx`'s teler-/bedrijfsnaam-veld, database-kolomnamen,
`melderCode()`/`Melder#XXXXXX`) is **bewust niet meegenomen** — de
gebruiker koos expliciet voor "ook de nieuwe termen overnemen in de
handleiding", wetend dat dit een tijdelijke terminologie-mismatch met de
rest van de app oplevert.

### Waarom
De AV is een juridisch document dat zijn eigen gedefinieerde begrippen
onafhankelijk van de productcopy mag hanteren — maar de gebruiker wilde
dat de handleiding (het eerste wat een nieuwe gebruiker leest) daar
terminologisch bij aansluit, ook al loopt de rest van de UI daar nu op
achter. Een volledige UI-brede hernoeming (Tijdlijn-labels, Export-tab,
Groepen-pagina's, databasekolommen) was expliciet buiten scope van deze
wijziging — een grotere, aparte beslissing.

### Impact
- **Tijdelijke inconsistentie is bewust, niet vergeten**: een toekomstige
  sessie die "melding"/"dossier" in de Handleiding tegenkomt terwijl de
  rest van de app ook nog steeds "melding"/"dossier" zegt, mag dit niet
  zomaar terugdraaien naar de oude AV-taal — controleer eerst of de AV
  inmiddels weer gewijzigd is.
- Als de gebruiker ooit besluit de terminologie ook elders in de UI door
  te voeren: dat raakt substantieel meer bestanden (BottomNav-tab
  "Melding", ExportPage "Dossier", GroepPage "Groepsdossier",
  `melderCode()`) en is een eigen, expliciet af te stemmen taak — niet
  automatisch afleiden uit deze AV/Handleiding-wijziging.
- Root-CLAUDE.md's regel "gebruik Nederlandse namen voor domeinlogica
  (perceel, spuitdatum, melding, etc.)" gaat over de **code/het
  datamodel** (kolomnamen, variabelen) — die zijn hier bewust NIET
  gewijzigd, alleen de zichtbare tekst in twee specifieke, puur
  tekstuele componenten (AV, Handleiding).

### Herzien (2026-07-01): teruggedraaid naar Melding/Dossier/Buurtdossier
De gebruiker heeft deze keuze teruggedraaid: geen uitrol elders in de UI
(de bijbehorende NEXT_STEPS-taak is komen te vervallen), en de AV +
Handleiding zijn beide teruggezet naar de v1.1-terminologie
(**Waarneming → Melding**, **Logboek → Dossier**, **Gebiedsdossier →
Buurtdossier**, **Betrokkene → Teler**) zodat ze weer aansluiten bij de
rest van de app (BottomNav-tab "Melding", enz.). De "Coördinator"-
definitie is uit de AV verwijderd (los verzoek, geen onderdeel van deze
terminologie-mapping — de rol zelf blijft ongewijzigd bestaan in de
app). De bredere, neutrale productbeschrijving die tegelijk met v2.0
werd geïntroduceerd (bv. "geografisch registratieplatform voor het
documenteren van omgevingsmeldingen", scope breder dan alleen
spuitactiviteit) is **wel** behouden — alleen de vier gedefinieerde
kernbegrippen zijn teruggedraaid, niet de volledige v1.1-tekst.
