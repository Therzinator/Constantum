# Prompt voor Claude Chat — Privacyverklaring & Algemene Voorwaarden bijwerken

Plak alles hieronder (vanaf "PROMPT START") in een nieuwe Claude Chat-conversatie.
Niet bedoeld om in deze codebase uit te voeren — net als een migratie-bestand is dit
een los, handmatig te verwerken document.

---

## PROMPT START

Je bent een Nederlandse jurist gespecialiseerd in AVG/GDPR en algemene voorwaarden voor
SaaS-/burgerplatforms. Ik wil de Privacyverklaring en Algemene Voorwaarden van mijn app
**SpuitLogger** volledig herschrijven naar de huidige staat van de app — de huidige
teksten (versie 1.0, laatst gewijzigd 21-06-2026) zijn verouderd en beschrijven een
aantal functies niet (meer) correct.

### Wat SpuitLogger is

Een Nederlandse, mobiel-georiënteerde webapp (React/Vite + Supabase) waarmee bewoners
spuitactiviteiten met gewasbeschermingsmiddelen bij hun woning documenteren als
juridisch bewijsmateriaal: tijdstempels (RFC 3161), cryptografische hashes (SHA-256) en
officiële weerdata (KNMI/Open-Meteo).

### Volledige functielijst (huidige staat, ter vervanging van de oude tekst)

**Account & profiel**
- Registratie met e-mail/wachtwoord via Supabase Auth. E-mailadres wordt **gehasht
  (SHA-256)** opgeslagen, niet leesbaar in de database. Wachtwoord via Supabase Auth
  (bcrypt), nooit leesbaar voor het platform.
- Elk account heeft een `trust_score` (0-100), die automatisch stijgt/daalt op basis van
  accountleeftijd, moderatie-acties en misbruikdetectie. Trust-score bepaalt:
  - of een nieuwe melding automatisch ter beoordeling (`under_review`) of verborgen
    (`shadow`) gezet wordt;
  - hoeveel detail een ANDER groepslid van uw gedeelde melding ziet binnen een Groep
    (zie hieronder) — dit is een vrij nieuw mechanisme, leg dit goed uit.
- Rollen: gewone gebruiker, `coordinator` (moderatie/statistieken, geen toegang tot
  PII-bundels van andere melders), `admin` (volledige toegang, inclusief
  accountverwijdering en bulk-export van een buurtgebied).

**Een melding (kern-functionaliteit)**
- GPS-locatie (exacte coördinaten, door de gebruiker zelf op een kaart geplaatst),
  datum/tijd, vrije omschrijving, optionele gezondheidsklachten (bijzondere
  persoonsgegevenscategorie, AVG art. 9 — alleen verwerkt als de gebruiker dit zelf
  invult), foto's/video's (GPS uit EXIF-metadata verwijderd vóór opslag), automatische
  weerdata (Open-Meteo, optioneel ook officiële KNMI-data met een eigen API-key van de
  gebruiker), SHA-256-hash + RFC 3161-tijdstempel (ontvangen van de externe
  tijdstempelautoriteit Freetsa.org — die krijgt UITSLUITEND de hash, geen
  persoonsgegevens).
- Belangrijke nuance t.o.v. de oude tekst: **alleen de eigen "thuislocatie" van de
  gebruiker wordt afgerond/geanonimiseerd (~1 km) in exports.** De GPS-locatie VAN DE
  MELDING ZELF is en blijft exact, en wordt — als de melder daarvoor kiest (zie
  "buurt-delen" hieronder) — ook als exacte kaartpin getoond aan andere gebruikers
  binnen hun ingestelde straal. Beschrijf dit nauwkeurig, claim niet dat "locatie nooit
  exact gedeeld wordt" in algemene zin — dat is feitelijk onjuist voor de melding-pin.

**"Buurt-delen" (peer-to-peer, anoniem, los van Groepen)**
- Per melding kiest de melder of die gedeeld wordt met "de buurt" (`opt_in_buurt`).
- Andere gebruikers zien gedeelde meldingen van anderen alleen binnen een zelf
  ingestelde straal (1 / 2,5 / 5 km) rond hun eigen positie, met een hard maximum van
  5 km.
- De melder is voor andere gebruikers altijd **pseudoniem** ("Melder#XXXXXX",
  afgeleid van de gehashte e-mail), nooit met naam/e-mailadres.
- Een gedeelde melding van een ander wordt pas **30 minuten na het melden** zichtbaar —
  dit is een bewuste maatregel tegen het herleiden van de identiteit van een melder via
  timing (bijv. door een teler die zich onder een andere naam bij de buurt aansluit).
- Dit geldt niet voor coordinator/admin-overzichten (zie "Coördinatie" hieronder), die
  hebben altijd direct, volledig zicht.

**Groepen (nieuw, bestaat NAAST buurt-delen — de oude tekst kent dit concept niet)**
- Gebruikers kunnen een Groep starten (zelfgekozen naam, geen koppeling aan postcode of
  een ander persoonsgegeven) of lid worden van een openbare Groep, of via een
  uitnodiging (link, QR-code, of delen via WhatsApp/Signal/e-mail e.d. met een
  kant-en-klare uitnodigingstekst) bij een besloten Groep.
- Rollen binnen een Groep: lid, beheerder, hoofdbeheerder.
- Een melder bepaalt zelf, per Groep én per melding, of een melding met die Groep
  gedeeld wordt (twee aparte schakelaars die beide aan moeten staan).
- **Belangrijk voor de tekst:** hoeveel detail een ANDER groepslid van een gedeelde
  melding ziet (exacte locatie, omschrijving, foto's, wie de melder is) hangt af van de
  trust-score van de KIJKER (niet de melder) — drie niveaus (laag/gemiddeld/hoog).
  Foto's en exacte locatie worden alleen aan het hoogste trust-niveau getoond. Dit is
  een nieuw, voor de gebruiker relevant mechanisme dat nog NERGENS in de huidige
  Privacyverklaring/Voorwaarden beschreven staat.

**Feedback-systeem (nieuw, ontbreekt in de huidige tekst)**
- Gebruikers kunnen "technische problemen" (zichtbaar voor alle ingelogde gebruikers,
  als laagdrempelige bugtracker) of "vragen/opmerkingen/complimenten" (alleen zichtbaar
  voor de melder zelf en een admin) indienen.
- Eigen feedback is door de gebruiker zelf verwijderbaar; een admin kan alle feedback
  verwijderen.

**Coördinatie/moderatie (rol: coordinator/admin)**
- Coordinator/admin zien alle meldingen (incl. PII), kunnen trust-scores aanpassen,
  meldingen goedkeuren/verbergen (shadow), en genereren geanonimiseerde
  buurtrapportages (aggregaties per postcodegebied, geen individuele identificatie).
- Alleen admin (niet coordinator) mag: accounts verwijderen, verwijderde meldingen
  herstellen ("Prullenbak", tot 14 dagen terug), en een buurtgebied-export
  (CSV/PDF-dossier) maken die individuele meldingen + PII van ALLE melders in een
  getekend gebied bundelt — dit is een zwaardere, bewust afgeschermde actie.

**Export & dataportabiliteit**
- Eigen dossier als PDF (incl. hash/RFC3161/foto's), CSV, of volledige JSON-backup
  (incl. foto's) — en JSON-import om een eigen backup te herstellen.
- Account + alle eigen data verwijderbaar via Instellingen, met directe lokale
  verwijdering en een cloud-verwijderverzoek.

**Opslag/infrastructuur**
- Database + Auth + Storage: Supabase, regio Frankfurt (EU).
- Foto's/video's: Supabase Storage-bucket, plus een lokale IndexedDB-cache voor
  offline-gebruik op het eigen apparaat.
- Kaarten/locatiegegevens: OpenStreetMap (tegels) en PDOK (Nederlandse overheid:
  kadastrale percelen, Natura 2000-gebieden, postcode/BAG) — geen persoonsgegevens
  worden hiernaartoe gestuurd, alleen coördinaten.
- Weerdata: Open-Meteo (gratis, geen account) en optioneel KNMI Open Data (gebruiker
  voert zelf een eigen API-key in).
- Tijdstempeling: Freetsa.org (RFC 3161), ontvangt alleen de hash.

### Wat ik nog NIET zeker weet (graag in de tekst behoedzaam/voorwaardelijk formuleren
of als open vraag aan mij terugstellen, niet zelf invullen)

- Exacte bewaartermijnen zijn nog niet heroverwogen sinds de vorige versie (10 jaar
  meldingen/bijlagen, 7 jaar audit log, RFC 3161-tokens permanent, account + 30 dagen) —
  vraag mij of dit nog steeds de gewenste termijnen zijn, verander ze niet zelf.
- Het is nog niet bevestigd of/hoe RLS (database-rechten) een groepslid met hoge
  trust-score daadwerkelijk toegang geeft tot foto's van een andermans melding binnen
  die groep, of dit louter een UI-laag is — formuleer de tekst zo dat ze niet méér
  belooft dan technisch afgedwongen wordt, en vraag mij dit te bevestigen.
- Ik heb nog geen definitieve keuze gemaakt of de `coordinator`-rol blijft bestaan of
  ooit verdwijnt — schrijf de tekst zo dat een toekomstige rolwijziging niet meteen de
  hele Voorwaarden incorrect maakt (bijv. door rollen in algemene termen te beschrijven
  i.p.v. namen hard te koppelen aan specifieke bevoegdheden voor altijd).

### Wat ik wil ontvangen

1. Een volledig herschreven **Privacyverklaring** (Nederlands, AVG/GDPR/UAVG-conform,
   begrijpelijke taal, genummerde secties zoals de huidige opzet: wie zijn wij, welke
   gegevens, waarom, bewaartermijnen, met wie gedeeld, beveiliging, rechten, cookies,
   wijzigingen).
2. Volledig herschreven **Algemene Voorwaarden** (Nederlands, genummerde artikelen zoals
   de huidige opzet: definities, toegang/gebruik, verboden gebruik, bewijswaarde/
   aansprakelijkheid, IE/data, privacy-verwijzing, Groepen-functionaliteit i.p.v. alleen
   "Buurtdossier", beschikbaarheid, wijziging, beëindiging, toepasselijk recht).
3. Beide als kant-en-klare platte tekst (geen markdown-opmaak, geen HTML) zodat ik ze
   direct in een JavaScript template literal kan plakken — exact zoals de huidige
   bestanden dat al doen (zie de structuur hierboven, met `\n\n` tussen paragrafen).
4. Een korte changelog onderaan: wat is feitelijk gewijzigd t.o.v. de oude tekst en
   waarom (zodat ik dit makkelijk kan reviewen vóór publicatie).
5. Verhoog het versienummer en zet de datum van vandaag (vraag mij naar de datum als je
   die niet zeker weet, raad niet).

## PROMPT EINDE
