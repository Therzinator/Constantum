import { JuridischModal } from '../onboarding/JuridischModal.jsx';

// Bronnen voor de claims in het verhaal hieronder — op verzoek toegevoegd
// (2026-06-23) na het signaleren dat de oorspronkelijke tekst geen
// bronvermelding had, terwijl dit platform juist bewijswaarde claimt.
const BRONNEN = [
  {
    label: 'RIVM OBO-studie (Onderzoek Blootstelling Omwonenden) — Figueiredo et al. (2021), JMIR Research Protocols, vol. 10, iss. 4, e27883',
    relevantie: 'Basis voor de 27%-statistiek (woningen binnen 250m van agrarische percelen) en het gebrek aan blootstellingsdata vóór het OBO-onderzoek.',
    urls: ['https://www.researchprotocols.org/2021/4/e27883', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8116989/']
  },
  {
    label: 'GGD Leefomgeving — Bestrijdingsmiddelen',
    relevantie: 'Bevestigt het in 2023 gestarte RIVM-vervolgonderzoek naar ziektepatronen bij omwonenden, en de rol van bewonersgroepen (Bollenboos) bij het agenderen ervan.',
    urls: ['https://ggdleefomgeving.nl/schadelijke-stoffen/bestrijdingsmiddelen/']
  },
  {
    label: 'Vereniging Leefmilieu — Pesticiden',
    relevantie: 'De casus van bollenveld-bewoners die aandrongen op onderzoek, wat leidde tot de RIVM-opdracht.',
    urls: ['https://www.leefmilieu.nl/pesticiden']
  },
  {
    label: 'Pointer / KRO-NCRV — Ongemerkt vergiftigd door bestrijdingsmiddelen',
    relevantie: 'Uitspraken van neuroloog Jorrit Hoff over pesticiden en Parkinson, en de erkenning door het Ctgb dat testmethoden voor langetermijneffecten tekortschieten.',
    urls: ['https://pointer.kro-ncrv.nl/ongemerkt-vergiftigd-door-bestrijdingsmiddelen-invloed-pesticiden-op-gezondheid']
  },
  {
    label: 'PAN Europe / Europese rechtszaak glyfosaat',
    relevantie: 'Juridische procedure bij het Europees Hof van Justitie — onvolledigheid van blootstellingsdata is een van de zeven formele argumenten.',
    urls: [
      'https://www.waterforum.nl/41099-europese-milieuorganisaties-starten-juridische-procedure-tegen-eu-goedkeuring-glyfosaat/',
      'https://www.boerderij.nl/rechtszaak-tegen-europese-goedkeuring-glyfosaat-van-start',
      'https://www.foodwatch.org/nl/current-nieuws/foodwatch-sluit-aan-bij-europese-rechtszaak-tegen-glyfosaat'
    ]
  },
  {
    label: 'ScienceDirect — Residential proximity to crops and mortality (Nederland, jan. 2022)',
    relevantie: 'Epidemiologisch onderzoek naar sterfte/ziektepatronen in relatie tot afstand tot agrarische percelen — voorbeeld van het type onderzoek waar SpuitLogger-data aanvullende waarde voor heeft.',
    urls: ['https://www.sciencedirect.com/science/article/pii/S0048969722000213']
  }
];

const ACHTERGRONDCONTEXT = [
  { label: 'RIVM-rapport 2019-0052 — Bestrijdingsmiddelen en omwonenden', url: 'https://www.rivm.nl/bibliotheek/rapporten/2019-0052.pdf' },
  { label: 'NVWA — Zorgen over bestrijdingsmiddelen', url: 'https://www.nvwa.nl/onderwerpen/gewasbescherming/zorgen-over-bestrijdingsmiddelen' }
];

// Achtergrondverhaal bij "Bijdragen aan wetenschappelijk onderzoek"
// (GegevensPrivacyInstelling.jsx) — zelfde modal-chrome als de
// Privacyverklaring/Algemene Voorwaarden (JuridischModal), maar bewust in
// wit lettertype (i.p.v. de standaard text-secondary) — dit is een
// overtuigend/motiverend verhaal, geen juridische tekst, en moet er
// nadrukkelijker uitspringen.
export function WaaromDitErtoeDoetModal({ onSluiten }) {
  return (
    <JuridischModal titel="Waarom dit ertoe doet" onSluiten={onSluiten}>
      <div style={{ color: '#ffffff' }}>
        {`Uw melding telt — letterlijk

Bewoners rond bollenvelden in de Bollenstreek maakten zich al jaren zorgen, maar er was vrijwel geen wetenschappelijk bewijs over pesticiderisico's voor omwonenden — onderzoekers wisten simpelweg niet hoeveel mensen blootstonden en wanneer. Een groep bewoners verenigde zich, documenteerde systematisch en drong aan op onderzoek. Het resultaat: de Gezondheidsraad gaf opdracht tot onderzoek, het RIVM voerde het uit, en voor het eerst in Nederland werd aangetoond dat bewoners nabij gespoten velden meetbaar meer bestrijdingsmiddelen binnenkrijgen dan andere mensen.

Dat onderzoek bestond omdat bewoners hun stem lieten horen met data. SpuitLogger doet hetzelfde — maar dan structureel, met juridische tijdstempels en weerdata erbij.

Wat onderzoekers met uw data kunnen doen:
Ongeveer 27% van alle woningen in Nederland staat binnen 250 meter van een bebouwd agrarisch perceel — maar over de gezondheidsrisico's voor deze groep is nog altijd weinig bekend. Lopend RIVM-onderzoek (gestart in 2023) onderzoekt nu of mensen die dicht bij landbouwgrond wonen vaker bepaalde ziektes krijgen, zoals Parkinson en bepaalde vormen van kanker.

Dat onderzoek heeft één fundamenteel probleem: het weet niet precies wanneer er gespoten is, met welke windrichting, en of bewoners op dat moment buiten waren. SpuitLogger-data vult precies dat gat — geolocaliseerd, meteorologisch onderbouwd en tijdgestempeld.

Concrete impact die al bereikt is:
Neuroloog Jorrit Hoff, gespecialiseerd in Parkinson, stelt ondubbelzinnig dat verschillende wetenschappelijke onderzoeken aantonen dat blootstelling aan pesticiden de kans op Parkinson vergroot — en dat boeren en daarna omwonenden degenen zijn die het meeste risico lopen. Deze kennis heeft meegespeeld in Europese beleidsbeslissingen en rechtszaken.

PAN Europe en Nederlandse milieuorganisaties voeren momenteel een juridische procedure bij het Europees Hof van Justitie tegen de hergoedkeuring van glyfosaat — een van de zeven juridische argumenten is de onvolledigheid van de blootstellingsdata waarop de Europese Commissie haar besluit heeft gebaseerd. Precies het soort data dat SpuitLogger structureel verzamelt.

Wat u deelt — en wat niet:
Uw naam, adres en e-mailadres worden nooit gedeeld. Wat onderzoekers ontvangen is: datum, type waarneming, windrichting, weerdata en postcodegebied. Geen enkel gegeven is herleidbaar naar u persoonlijk. U kunt deelname op elk moment uitschakelen via Instellingen.`}
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ color: '#ffffff', fontWeight: 700, marginBottom: 8 }}>Bronnen</div>
        <ol style={{ color: '#ffffff', fontSize: '0.75rem', lineHeight: 1.5, paddingLeft: 18, margin: 0 }}>
          {BRONNEN.map((bron) => (
            <li key={bron.label} style={{ marginBottom: 10 }}>
              <div>{bron.label}</div>
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{bron.relevantie}</div>
              {bron.urls.map((url) => (
                <div key={url}>
                  <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{url}</a>
                </div>
              ))}
            </li>
          ))}
        </ol>

        <div style={{ color: '#ffffff', fontWeight: 700, margin: '12px 0 8px' }}>Achtergrondcontext (niet als citaat gebruikt)</div>
        <ul style={{ fontSize: '0.75rem', lineHeight: 1.5, paddingLeft: 18, margin: 0 }}>
          {ACHTERGRONDCONTEXT.map((bron) => (
            <li key={bron.url} style={{ marginBottom: 6 }}>
              <span style={{ color: '#ffffff' }}>{bron.label}</span>{' '}
              <a href={bron.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{bron.url}</a>
            </li>
          ))}
        </ul>
      </div>
    </JuridischModal>
  );
}
