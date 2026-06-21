import { JuridischModal } from './JuridischModal.jsx';

const VERSIE = '1.0';
const LAATST_GEWIJZIGD = '21-06-2026';

export function AlgemeneVoorwaardenModal({ onSluiten }) {
  return (
    <JuridischModal titel="Algemene Voorwaarden" versie={VERSIE} laatstGewijzigd={LAATST_GEWIJZIGD} onSluiten={onSluiten}>
      {`Samenvatting: SpuitLogger is een hulpmiddel voor het documenteren van spuitactiviteiten. U bent zelf verantwoordelijk voor de juistheid van uw meldingen. Het platform biedt technische ondersteuning maar is geen juridisch adviseur en garandeert geen juridisch succes.

Artikel 1 — Definities
In deze algemene voorwaarden wordt verstaan onder:
• "Platform": SpuitLogger, de webapplicatie.
• "Gebruiker": iedere natuurlijke persoon die een account aanmaakt op het platform.
• "Melding": een door de gebruiker aangemaakte registratie van een waargenomen spuitactiviteit, inclusief alle bijbehorende gegevens (locatie, tijdstip, foto's, weerdata).
• "Dossier": een verzameling meldingen van één gebruiker, inclusief de bijbehorende juridische metadata (hashes, tijdstempels).
• "Buurtdossier": een geanonimiseerde samenvoeging van dossiers van meerdere gebruikers in een geografisch aaneengesloten gebied.
• "Coördinator": een door SpuitLogger aangestelde of erkende beheerder die toegang heeft tot geanonimiseerde buurtdossierdata voor coördinatie van collectieve juridische acties.
• "Teler": de agrarische ondernemer wiens perceel in een melding wordt aangeduid.

Artikel 2 — Toegang en gebruik
SpuitLogger is uitsluitend toegankelijk na registratie met een geldig e-mailadres en verificatie van dat adres. Het platform is bedoeld voor burgers die spuitactiviteiten met gewasbeschermingsmiddelen willen documenteren in de directe omgeving van hun woning of verblijfplaats. De gebruiker dient minimaal 18 jaar oud te zijn. De gebruiker mag het platform uitsluitend gebruiken voor rechtmatige doeleinden in overeenstemming met het Nederlandse recht en het recht van de Europese Unie. Commercieel gebruik van de data of het platform zonder schriftelijke toestemming van SpuitLogger is niet toegestaan.

Artikel 3 — Verboden gebruik en misbruik
Het is uitdrukkelijk verboden om:
• Bewust onjuiste, gefabriceerde of misleidende meldingen in te voeren.
• Het platform te gebruiken als instrument voor gerichte intimidatie, laster of pesterijen jegens individuele telers of andere personen.
• Gecoördineerde campagnes op te zetten met als primaire doel reputatieschade bij een specifieke ondernemer zonder dat sprake is van aantoonbare spuitactiviteit.
• Meerdere accounts aan te maken om misbruikdetectie te omzeilen.
• Technische maatregelen te omzeilen, inclusief maar niet beperkt tot het manipuleren van GPS-coördinaten, tijdstempels of andere metadata.
• Data van andere gebruikers te benaderen of te proberen te achterhalen.
SpuitLogger behoudt het recht accounts met onmiddellijke ingang te blokkeren bij aantoonbaar misbruik, zonder voorafgaande waarschuwing en zonder restitutie van eventuele betaalde bedragen.

Artikel 4 — Bewijswaarde en aansprakelijkheid
SpuitLogger biedt technische hulpmiddelen voor juridische documentatie, waaronder cryptografische hashing (SHA-256) en tijdstempeling (RFC 3161). Het platform garandeert niet dat meldingen in een specifieke juridische of bestuurlijke procedure als bewijs worden geaccepteerd. De beoordeling van bewijs is voorbehouden aan rechters en bevoegde instanties.
De gebruiker is volledig verantwoordelijk voor de juistheid en volledigheid van ingevoerde informatie. Een onjuiste melding kan juridische gevolgen hebben voor de gebruiker.
SpuitLogger is niet aansprakelijk voor schade — direct of indirect — die voortvloeit uit het gebruik van het platform, de gegenereerde dossiers of de gevolgen van juridische procedures die op basis van de dossiers worden gestart.
SpuitLogger is niet aansprakelijk voor schade als gevolg van onbeschikbaarheid van het platform, dataverlies door technische storingen, of fouten in automatisch opgehaalde weerdata.
De maximale aansprakelijkheid van SpuitLogger is in alle gevallen beperkt tot het bedrag dat de gebruiker in de twaalf maanden voorafgaand aan het schadeveroorzakende feit aan SpuitLogger heeft betaald.
De gebruiker vrijwaart SpuitLogger van alle aanspraken van derden — inclusief telers — die voortvloeien uit door de gebruiker ingevoerde gegevens of het gebruik van gegenereerde dossiers.

Artikel 5 — Intellectueel eigendom en data
De gebruiker behoudt het intellectueel eigendom op zijn eigen meldingen en dossiers. Door het gebruik van het platform verleent de gebruiker SpuitLogger een niet-exclusieve, beperkte licentie om de data te verwerken voor de doeleinden beschreven in de privacyverklaring. Deze licentie eindigt bij verwijdering van het account. Geanonimiseerde en geaggregeerde data kan — met toestemming van de gebruiker — worden gebruikt voor wetenschappelijk onderzoek (zie privacyverklaring artikel 3.3). Het platform zelf, inclusief de broncode, het ontwerp en de juridische documenten, is eigendom van SpuitLogger en mag niet worden gekopieerd, gedistribueerd of voor commerciële doeleinden worden gebruikt zonder schriftelijke toestemming.

Artikel 6 — Privacy en gegevensbescherming
SpuitLogger verwerkt persoonsgegevens conform de Algemene Verordening Gegevensbescherming (AVG) en de UAVG. De volledige privacyverklaring is beschikbaar via Instellingen → Juridisch → Privacyverklaring. De gebruiker heeft te allen tijde het recht zijn gegevens in te zien, te corrigeren en te verwijderen conform de rechten beschreven in de privacyverklaring. SpuitLogger implementeert technische maatregelen om de identiteit van melders te beschermen, waaronder e-mailhashing, GPS-verwijdering uit fotometadata en locatieanonimisering in externe outputs.

Artikel 7 — Buurtdossier en collectieve actie
Deelname aan het buurtdossier is volledig vrijwillig en vereist expliciete opt-in via de app. De coördinator heeft uitsluitend toegang tot geanonimiseerde meldingsdata van gebruikers die zich hebben aangemeld. De coördinator is gebonden aan geheimhouding ten aanzien van de identiteit van individuele melders. SpuitLogger faciliteert de technische samenwerking maar is geen partij in eventuele juridische procedures die uit het buurtdossier voortvloeien. Gebruikers die deelnemen aan een buurtdossier geven daarmee toestemming voor het opnemen van hun geanonimiseerde meldingen in een collectief dossier. Zij geven geen toestemming voor het vrijgeven van hun persoonsgegevens aan andere melders.

Artikel 8 — Beschikbaarheid en onderhoud
SpuitLogger streeft naar maximale beschikbaarheid maar kan geen ononderbroken toegang garanderen. Voor geplande onderhoudswerkzaamheden wordt minimaal 48 uur van tevoren een melding in de app geplaatst. SpuitLogger behoudt het recht de dienst of onderdelen daarvan zonder voorafgaande kennisgeving te wijzigen of te beëindigen in geval van technische noodzaak, veiligheidsproblemen of wettelijke verplichtingen.

Artikel 9 — Wijziging van de voorwaarden
SpuitLogger behoudt het recht deze algemene voorwaarden te wijzigen. Bij wezenlijke wijzigingen ontvangt de gebruiker minimaal 30 dagen voor de ingangsdatum een melding in de app. Voortgezet gebruik van het platform na de ingangsdatum van gewijzigde voorwaarden geldt als acceptatie van de nieuwe voorwaarden. Als u niet akkoord gaat met gewijzigde voorwaarden, kunt u uw account verwijderen via Instellingen → Account verwijderen.

Artikel 10 — Beëindiging van het account
De gebruiker kan het account te allen tijde en zonder opgave van redenen verwijderen via Instellingen → Account verwijderen. Gegevensverwijdering vindt plaats conform de privacyverklaring.
SpuitLogger kan een account met onmiddellijke ingang beëindigen bij: (a) aantoonbaar misbruik als omschreven in artikel 3, (b) een onherroepelijke rechterlijke uitspraak die daartoe verplicht, (c) herhaalde schending van deze voorwaarden na waarschuwing.
Bij beëindiging door SpuitLogger wordt de gebruiker hierover geïnformeerd via het geregistreerde e-mailadres, tenzij dit in strijd is met een wettelijke verplichting of rechterlijk bevel.
Meldingen die deel uitmaken van een actief rechtbankbevel of een lopende juridische procedure worden bewaard voor de duur van die procedure, ook na accountverwijdering.

Artikel 11 — Toepasselijk recht en geschillen
Op deze algemene voorwaarden is uitsluitend Nederlands recht van toepassing. Geschillen voortvloeiend uit het gebruik van het platform worden bij uitsluiting voorgelegd aan de bevoegde rechter in Nederland. Alvorens een gerechtelijke procedure te starten verplichten partijen zich tot het voeren van overleg om tot een minnelijke schikking te komen. Voor klachten over de verwerking van persoonsgegevens kunt u terecht bij de Autoriteit Persoonsgegevens via autoriteitpersoonsgegevens.nl.

Artikel 12 — Contact
Voor vragen over deze algemene voorwaarden of de privacyverklaring kunt u contact opnemen via:
SpuitLogger
SpuitLogger@protonmail.com`}
    </JuridischModal>
  );
}
