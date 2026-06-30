import { berekenPasquillKlasse } from '../weather/pasquill.js';

// Omstandighedenregister — registreert objectieve weerfeiten en toetst aan
// juridische normen. Geen spuittypeindicaties — die zijn aanvechtbaar en
// niet bewijs. De teler is verplicht een spuitregistratie bij te houden
// (art. 67 EU-Vo 1107/2009), opvraagbaar via NVWA. Komt overeen met
// analyseerSpuitpatroon() uit docs/index.html.
export function analyseerSpuitpatroon(melding) {
  const weer = melding.weather || {};
  const regen = weer.precipitation ?? 0;
  const rv = weer.humidity ?? weer.relative_humidity ?? 0;
  const wind = weer.wind_speed ?? 0;
  const gusts = weer.wind_gusts ?? 0;
  const temp = weer.temperature ?? null;
  const uur = new Date(melding.timestamp_local).getHours();
  const isNacht = uur >= 21 || uur <= 5;

  const indicaties = [];
  let risicoScore = 0;

  // Norm: wind >5 m/s (18 km/h) — Besluit gewasbeschermingsmiddelen art. 4
  if (wind > 18) {
    indicaties.push({
      label: '⚠️ Wind boven spuitnorm',
      reden: `${wind} km/h gemeten — norm is ≤18 km/h (5 m/s) bij toepassing gewasbeschermingsmiddelen (Besluit gewasbeschermingsmiddelen art. 4)`,
      score: 3, kleur: 'danger'
    });
    risicoScore += 3;
  } else if (wind > 12) {
    indicaties.push({
      label: '⚠️ Wind nabij spuitnorm',
      reden: `${wind} km/h gemeten — norm is ≤18 km/h (5 m/s); windstoten ${gusts} km/h`,
      score: 2, kleur: 'warning'
    });
    risicoScore += 2;
  }

  if (isNacht) {
    indicaties.push({
      label: '🌙 Nachtelijke spuitactiviteit',
      reden: `Tijdstip: ${uur}:00u — nachtelijk spuiten valt buiten gangbare agrarische werktijden en is bij sommige vergunningen verboden`,
      score: 2, kleur: 'warning'
    });
    risicoScore += 2;
  }

  if (rv > 85) {
    indicaties.push({
      label: '💧 Hoge luchtvochtigheid',
      reden: `${rv}% relatieve luchtvochtigheid — bij hoge RV vertraagt verdamping van gewasbeschermingsmiddelen en neemt blootstellingsrisico toe`,
      score: 1, kleur: 'info'
    });
    risicoScore += 1;
  }

  if (regen > 1) {
    indicaties.push({
      label: '🌧️ Recente neerslag',
      reden: `${regen} mm neerslag geregistreerd — spuiten tijdens of direct na neerslag verhoogt afspoeling naar oppervlaktewater (Wm art. 6.3)`,
      score: 1, kleur: 'info'
    });
    risicoScore += 1;
  }

  if (temp !== null && temp > 25) {
    indicaties.push({
      label: '🌡️ Hoge temperatuur',
      reden: `${temp}°C gemeten — hoge temperatuur vergroot de verdampingssnelheid van gewasbeschermingsmiddelen; werkzame stoffen kunnen langer in de buurtlucht aanwezig blijven (geen wettelijke spuitnorm, wel erkende blootstellingsfactor)`,
      score: 1, kleur: 'info'
    });
    risicoScore += 1;
  }

  if (rv > 0 && rv < 45) {
    indicaties.push({
      label: '🌵 Lage luchtvochtigheid',
      reden: `${rv}% relatieve luchtvochtigheid — droge lucht versnelt verdamping van middelen van gewas en bodem; concentraties in de directe omgeving nemen daardoor toe`,
      score: 1, kleur: 'info'
    });
    risicoScore += 1;
  }

  const isDay = weer.is_day !== undefined ? weer.is_day : (uur >= 6 && uur < 21);
  const pasquill = berekenPasquillKlasse(wind, weer.cloud_cover ?? null, isDay);
  if (pasquill?.klasse === 'E' || pasquill?.klasse === 'F') {
    indicaties.push({
      label: `🌫️ Stabiele atmosfeer (klasse ${pasquill.klasse})`,
      reden: `Pasquill-klasse ${pasquill.klasse} (${pasquill.label}) — stabiele atmosferische omstandigheden verminderen verticale luchtmenging; spuitnevel en dampen blijven langer laag bij de grond in de woonomgeving`,
      score: 1, kleur: 'info'
    });
    risicoScore += 1;
  }

  indicaties.push({
    label: '📋 Spuitregistratieplicht',
    reden: 'De teler is verplicht elke toepassing vast te leggen (art. 67 EU-Vo 1107/2009). Opvraagbaar via NVWA. Gebruik dit dossier als aanleiding voor een handhavingsverzoek.',
    score: 0, kleur: 'muted'
  });

  return { indicaties, risicoScore };
}
