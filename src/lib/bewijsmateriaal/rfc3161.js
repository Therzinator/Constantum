// ============================================================
// RFC 3161 TIJDSTEMPELING via Freetsa.org (gratis, publiek)
// ============================================================
// Bouwt een minimale DER-encoded TimeStampReq (RFC 3161 §2.4)
// hash: hex-string van SHA-256 digest van het te timestampen bericht
export function bouwTSQ(hashHex) {
  // SHA-256 OID: 2.16.840.1.101.3.4.2.1
  const sha256Oid = new Uint8Array([0x30,0x0d,0x06,0x09,0x60,0x86,0x48,0x01,0x65,0x03,0x04,0x02,0x01,0x05,0x00]);
  // messageImprint: SEQUENCE { AlgorithmIdentifier, OCTET STRING (hash) }
  const hashBytes  = new Uint8Array(hashHex.match(/.{2}/g).map(b => parseInt(b,16)));
  const octetStr   = new Uint8Array([0x04, 0x20, ...hashBytes]);
  const msgImprint = derSeq([...sha256Oid, ...octetStr]);
  // nonce: 8 willekeurige bytes
  const nonce      = crypto.getRandomValues(new Uint8Array(8));
  const nonceInt   = derInt(nonce);
  // certReq: BOOLEAN TRUE (vraag TSA-certificaat op)
  const certReq    = new Uint8Array([0x01,0x01,0xff]);
  // version: INTEGER 1
  const version    = new Uint8Array([0x02,0x01,0x01]);
  // TimeStampReq SEQUENCE
  const tsq = derSeq([...version, ...msgImprint, ...nonceInt, ...certReq]);
  return tsq;
}

export function derSeq(content) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  const len   = derLen(bytes.length);
  return new Uint8Array([0x30, ...len, ...bytes]);
}

export function derInt(bytes) {
  // Zorg dat hoge bit niet gezet is (positief getal)
  const b = bytes[0] & 0x80 ? new Uint8Array([0x00, ...bytes]) : bytes;
  return new Uint8Array([0x02, b.length, ...b]);
}

export function derLen(n) {
  if (n < 128) return [n];
  const hex = n.toString(16).padStart(2,'0');
  const b   = hex.match(/.{2}/g).map(x => parseInt(x,16));
  return [0x80 | b.length, ...b];
}

// Parseer minimal de TSR om genTime en serialNumber te extraheren
export function parseTSR(tsrBytes) {
  // Zoek de UTC/GeneralizedTime tag in de DER structuur
  let genTime = null;
  let serial  = null;
  const bytes = new Uint8Array(tsrBytes.buffer || tsrBytes);

  // Simpele lineaire scan naar UTCTime (0x17) of GeneralizedTime (0x18)
  for (let i = 0; i < bytes.length - 2; i++) {
    if ((bytes[i] === 0x17 || bytes[i] === 0x18) && bytes[i+1] >= 13) {
      const len  = bytes[i+1];
      const str  = Array.from(bytes.slice(i+2, i+2+len)).map(c => String.fromCharCode(c)).join('');
      // UTCTime: YYMMDDHHmmssZ, GeneralizedTime: YYYYMMDDHHmmssZ
      try {
        const y  = bytes[i] === 0x18 ? str.slice(0,4) : (parseInt(str.slice(0,2)) < 50 ? '20'+str.slice(0,2) : '19'+str.slice(0,2));
        const mo = bytes[i] === 0x18 ? str.slice(4,6) : str.slice(2,4);
        const d  = bytes[i] === 0x18 ? str.slice(6,8) : str.slice(4,6);
        const h  = bytes[i] === 0x18 ? str.slice(8,10) : str.slice(6,8);
        const mi = bytes[i] === 0x18 ? str.slice(10,12) : str.slice(8,10);
        const s  = bytes[i] === 0x18 ? str.slice(12,14) : str.slice(10,12);
        genTime  = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
        break;
      } catch { /* geen geldige datum op deze offset — scan verder naar de volgende tag */ }
    }
  }
  // Zoek INTEGER na een SEQUENCE met OID (serial number zit vroeg in de TSR)
  for (let i = 4; i < Math.min(bytes.length - 2, 200); i++) {
    if (bytes[i] === 0x02 && bytes[i+1] > 0 && bytes[i+1] <= 20) {
      const len   = bytes[i+1];
      const sBytes = bytes.slice(i+2, i+2+len);
      serial = Array.from(sBytes).map(b => b.toString(16).padStart(2,'0')).join('');
      if (serial.length >= 4) break;
    }
  }
  return { genTime, serial };
}
