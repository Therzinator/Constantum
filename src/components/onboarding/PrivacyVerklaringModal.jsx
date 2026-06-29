import { JuridischModal } from './JuridischModal.jsx';

const VERSIE = '1.0';
const LAATST_GEWIJZIGD = '21-06-2026';

export function PrivacyVerklaringModal({ onSluiten }) {
  return (
    <JuridischModal titel="Privacyverklaring" versie={VERSIE} laatstGewijzigd={LAATST_GEWIJZIGD} onSluiten={onSluiten}>
      {`SpuitLogger neemt uw privacy serieus. Deze verklaring legt in begrijpelijke taal uit welke gegevens wij verwerken, waarom, hoe lang, en welke rechten u heeft. De verklaring is opgesteld conform de Algemene Verordening Gegevensbescherming (AVG/GDPR) en de Nederlandse Uitvoeringswet AVG (UAVG).

1. Wie zijn wij?
SpuitLogger is een registratieplatform voor burgers die spuitactiviteiten met gewasbeschermingsmiddelen in hun woonomgeving willen documenteren. Het platform dient als juridisch dossierinstrument — meldingen worden voorzien van RFC 3161 tijdstempels, SHA-256 cryptografische hashes en KNMI-gecertificeerde weerdata.
Verantwoordelijke: SpuitLogger Platform — contactgegevens: SpuitLogger@protonmail.com
Toezichthouder: Autoriteit Persoonsgegevens (AP) — autoriteitpersoonsgegevens.nl

2. Welke gegevens verwerken wij?

2.1 Accountgegevens
• E-mailadres — voor authenticatie. Opgeslagen als SHA-256 cryptografische hash. Het originele e-mailadres is niet toegankelijk via de applicatie.
• Wachtwoord — versleuteld opgeslagen via Supabase Auth (bcrypt hashing). Wij hebben nooit toegang tot uw wachtwoord in leesbare vorm.

2.2 Meldingsgegevens
• GPS-coördinaten van de spuitlocatie (de pin die u plaatst op het perceel)
• Datum en tijdstip van de melding
• Beschrijving van de waarneming
• Weerdata op het moment van de melding (automatisch opgehaald via Open-Meteo / KNMI)
• Foto's en video's — GPS-coördinaten worden automatisch verwijderd uit de bestandsmetadata (EXIF) vóór opslag

2.3 Locatiegegevens (thuislocatie)
Uw thuislocatie wordt uitsluitend gebruikt voor afstandsberekeningen (bijv. afstand tot het spuitperceel). In externe outputs (PDF-dossier, Supabase) wordt deze locatie afgerond op twee decimalen — een nauwkeurigheid van circa 1 kilometer. Uw exacte woonadres is voor niemand zichtbaar.

2.4 Gezondheidsgegevens (bijzondere categorie)
Let op: Gezondheidsgegevens zijn een bijzondere categorie (AVG art. 9). Wij verwerken deze uitsluitend als u ze zelf invult. Door gezondheidsklachten in te voeren geeft u uitdrukkelijke toestemming voor de verwerking hiervan.

2.5 Technische metadata
• User agent (apparaattype en browserversie) — opgeslagen in de audit log voor forensische context
• App-versie op het moment van aanmaken van de melding
• RFC 3161 tijdstempel token — ontvangen van Freetsa.org, opgeslagen als bewijs van tijdstip

3. Waarom verwerken wij uw gegevens?

3.1 Juridische documentatie (gerechtvaardigd belang)
Het primaire doel van SpuitLogger is het ondersteunen van bewoners bij het opbouwen van juridisch bewijsmateriaal. Dit belang weegt zwaarder dan het privacy-nadeel omdat: (a) u zich vrijwillig aanmeldt, (b) de data uitsluitend uw eigen meldingen betreft, (c) het alternatief — geen documentatiemogelijkheid — u in een zwakkere positie laat bij juridische procedures.

3.2 Buurtdossier (toestemming)
Als u actief kiest voor deelname aan het buurtdossier (opt-in), worden uw geanonimiseerde meldingen samengevoegd met die van andere melders in uw gemeente. Dit doel vereist uw expliciete toestemming, die u te allen tijde kunt intrekken via Instellingen.

3.3 Wetenschappelijk onderzoek (toestemming, standaard ingeschakeld)
Geanonimiseerde, geaggregeerde data kan worden gedeeld met academische onderzoekers (zoals WUR, RIVM en IRAS) voor onderzoek naar pesticideblootstelling. Uw identiteit is hierbij volledig beschermd. U kunt dit uitschakelen via Instellingen → Gegevens & Privacy.

4. Hoe lang bewaren wij uw gegevens?
Wij hanteren de volgende bewaartermijnen:
• Meldingen en bijlagen: maximaal 10 jaar (juridische bewaartermijn voor dossierdocumenten)
• Accountgegevens: tot verwijdering van uw account + 30 dagen voor back-upverwerking
• Audit log (chain of custody): 7 jaar (wettelijke bewaarplicht voor juridische integriteit)
• RFC 3161 tijdstempel tokens: permanent (onderdeel van het onweerlegbare bewijs)
Na het verstrijken van de bewaartermijn of na accountverwijdering worden uw gegevens volledig en onomkeerbaar gewist uit alle systemen, inclusief back-ups.

5. Met wie delen wij uw gegevens?

5.1 Verwerkers
Wij werken uitsluitend met verwerkers die aan de AVG voldoen en met wie wij een verwerkersovereenkomst hebben gesloten:
• Supabase Inc. — databaseopslag en authenticatie. Servers in Frankfurt, EU. GDPR-compliant.
• Freetsa.org — ontvangt uitsluitend de SHA-256 hash van uw melding (geen persoonsgegevens). Gebruikt voor RFC 3161 tijdstempeling.
• KNMI Open Data / Open-Meteo — ontvangt uitsluitend de coördinaten van de spuitlocatie voor het ophalen van weerdata. Geen accountgegevens.
• OpenStreetMap — kaartweergave. Geen persoonsgegevens worden gedeeld.

5.2 Derden
Wij verkopen uw gegevens nooit aan derden. Uw gegevens worden uitsluitend gedeeld:
• Met rechterlijke instanties — uitsluitend op uw verzoek of op grond van een rechtbankbevel
• Met NVWA of omgevingsdiensten — uitsluitend op uw initiatief, als onderdeel van een handhavingsverzoek
• Met onderzoekers — uitsluitend volledig geanonimiseerde, geaggregeerde data als u hiervoor opt-in heeft gegeven
Belangrijk: Telers of andere betrokken partijen hebben geen toegang tot uw gegevens via SpuitLogger. Bij een rechtbankbevel tot openbaarmaking is uitsluitend de betrokken melder identificeerbaar, niet alle andere melders.

6. Hoe beveiligen wij uw gegevens?
• Versleutelde opslag via AES-256 (Supabase)
• Alle verbindingen via HTTPS/TLS 1.3
• E-mailadres opgeslagen als SHA-256 hash — niet leesbaar, ook niet door ons
• GPS uit foto's automatisch verwijderd via canvas-rerender vóór opslag
• Append-only audit log met database trigger — manipulatie is technisch onmogelijk
• RFC 3161 tijdstempeling via onafhankelijke tijdstempelautoriteit (Freetsa.org)
• Row Level Security (RLS) — u ziet uitsluitend uw eigen data

7. Uw rechten
Op grond van de AVG heeft u de volgende rechten. U kunt deze uitoefenen via de app of via SpuitLogger@protonmail.com.

7.1 Recht op inzage (art. 15)
U kunt uw volledige dossier inzien en exporteren via de app (Instellingen → Exporteer mijn gegevens).

7.2 Recht op rectificatie (art. 16)
U kunt uw meldingen bewerken. Wijzigingen worden gelogd in de audit log.

7.3 Recht op verwijdering (art. 17)
U kunt uw account en alle bijbehorende gegevens verwijderen via Instellingen → Account verwijderen. Verwijdering is onomkeerbaar. Meldingen die deel uitmaken van een lopend rechtbankbevel kunnen langer worden bewaard op grond van wettelijke verplichtingen.

7.4 Recht op overdraagbaarheid (art. 20)
U kunt een JSON-export van al uw meldingen downloaden via Instellingen.

7.5 Recht van bezwaar (art. 21)
U kunt bezwaar maken tegen verwerking op basis van gerechtvaardigd belang. Neem contact op via SpuitLogger@protonmail.com

7.6 Klachten
U kunt een klacht indienen bij de Autoriteit Persoonsgegevens via autoriteitpersoonsgegevens.nl of per post: Postbus 93374, 2509 AJ Den Haag.

8. Cookies en tracking
SpuitLogger gebruikt geen tracking cookies, advertentietrackers of analyticsdiensten van derden. Uitsluitend een functionele sessiecookie van Supabase Auth wordt gebruikt om u ingelogd te houden. Deze cookie is strikt noodzakelijk en vereist geen toestemming.

9. Wijzigingen in deze verklaring
Bij wezenlijke wijzigingen ontvangt u een melding in de app minimaal 14 dagen voor de ingangsdatum. U kunt altijd de actuele versie raadplegen via Instellingen → Juridisch → Privacyverklaring.`}
    </JuridischModal>
  );
}
