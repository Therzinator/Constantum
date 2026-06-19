import { sbClient } from './client.js';
import { idbGetBijlagen, idbSaveBijlage } from '../storage/indexedDB.js';
import { compressToThumbnail } from '../media/thumbnail.js';
import { sbAuditLog } from './auditLog.js';

// Upload bijlagen naar Supabase Storage + sla metadata op in attachments
// Komt overeen met sbSyncBijlagen() — user wordt meegegeven i.p.v. _sbUser global
export async function sbSyncBijlagen(meldingId, bestanden, user) {
  const sb = sbClient();
  if (!sb || !user || !bestanden?.length) return;

  const idbBijlagen = await idbGetBijlagen(meldingId);

  for (const bestand of bestanden) {
    if (!bestand.hash) {
      console.warn('[Supabase] Bijlage overgeslagen: geen hash voor', bestand.name);
      continue;
    }

    // Controleer of al geüpload én storage_path aanwezig is
    const { data: bestaand } = await sb.from('attachments')
      .select('id, storage_path')
      .eq('entry_id', meldingId)
      .eq('file_hash', bestand.hash)
      .maybeSingle();

    // Als metadata bestaat én storage_path gevuld is: niets te doen
    if (bestaand?.storage_path) {
      console.log('[Supabase] Bijlage al volledig aanwezig, overslaan:', bestand.name);
      continue;
    }

    // Haal dataUrl op uit IndexedDB — match uitsluitend op hash
    const idb = idbBijlagen.find(b => b.hash === bestand.hash);
    if (!idb?.dataUrl) {
      console.warn('[Supabase] Geen dataUrl in IDB voor bijlage:', bestand.name, '(hash:', bestand.hash, ')');
    }

    let storagePath = bestaand?.storage_path || null;

    // Upload naar Storage (opnieuw proberen als storage_path nog null was)
    if (idb?.dataUrl && !storagePath) {
      try {
        const res  = await fetch(idb.dataUrl);
        const blob = await res.blob();
        const path = `${user.id}/${meldingId}/${bestand.hash}_${bestand.name}`;

        const { error: upErr } = await sb.storage
          .from('spuitlog-bijlagen')
          .upload(path, blob, { contentType: bestand.type, upsert: true });

        if (upErr) {
          console.warn('[Supabase] Storage upload mislukt (metadata wordt toch opgeslagen):', upErr.message);
        } else {
          storagePath = path;
          console.log('[Supabase] Storage upload OK:', path);
        }
      } catch (e) {
        console.warn('[Supabase] Storage upload fout:', e.message);
      }
    }

    // Metadata insert of update — werkt zonder unieke DB constraint
    // Als rij al bestaat (bestaand.id bekend): update storage_path indien gevuld
    // Als rij nog niet bestaat: insert nieuw
    if (bestaand?.id) {
      // Rij bestaat al maar storage_path was null — update alleen als we nu wél een pad hebben
      if (storagePath) {
        const { error: updErr } = await sb.from('attachments')
          .update({ storage_path: storagePath })
          .eq('id', bestaand.id);
        if (updErr) {
          console.error('[Supabase] attachments update mislukt:', updErr.message);
        } else {
          console.log('[Supabase] attachments storage_path geüpdatet voor:', bestand.name);
        }
      }
    } else {
      // Nieuwe rij invoegen
      const { error: insErr } = await sb.from('attachments').insert({
        entry_id:       meldingId,
        user_id:        user.id,
        filename:       bestand.name       || null,
        mime_type:      bestand.type       || null,
        file_size:      bestand.size       || null,
        storage_bucket: 'spuitlog-bijlagen',
        storage_path:   storagePath,
        file_hash:      bestand.hash,
        exif:           bestand.exif       || null
      });
      if (insErr) {
        console.error('[Supabase] attachments insert mislukt:', insErr.message, '| code:', insErr.code);
      } else {
        console.log('[Supabase] attachments insert OK voor:', bestand.name);
        sbAuditLog(meldingId, 'bijlage_uploaded', {
          bestand: bestand.name,
          type:    bestand.type,
          size:    bestand.size,
          hash:    bestand.hash
        }, user);
      }
    }
  }
}

// Haal bijlage-metadata + dataUrl op van Supabase voor één entry
// Slaat de dataUrl ook op in IDB zodat de lightbox offline werkt
export async function laadBijlagenVanSupabase(meldingId, user) {
  const sb = sbClient();
  if (!sb || !user) return [];

  try {
    const { data: rows, error } = await sb
      .from('attachments')
      .select('filename, mime_type, file_size, storage_path, file_hash')
      .eq('entry_id', meldingId);

    if (error) {
      console.warn('[Supabase] attachments ophalen mislukt voor', meldingId, ':', error.message);
      return [];
    }
    if (!rows?.length) return [];

    const bestaandIdb = await idbGetBijlagen(meldingId);

    const bestanden = await Promise.all(rows.map(async row => {
      const bestand = {
        name:      row.filename  || 'bijlage',
        type:      row.mime_type || 'application/octet-stream',
        size:      row.file_size || 0,
        hash:      row.file_hash || null,
        thumbnail: null,
        dataUrl:   null
      };

      // Controleer of al in IDB (voorkom dubbele downloads)
      const idbMatch = bestaandIdb.find(b => b.hash === row.file_hash);
      if (idbMatch?.dataUrl) {
        bestand.dataUrl   = idbMatch.dataUrl;
        bestand.thumbnail = idbMatch.thumbnail || null;
        return bestand;
      }

      // Download van Supabase Storage via signed URL (1 uur geldig)
      if (row.storage_path) {
        try {
          const { data: signed, error: signErr } = await sb.storage
            .from('spuitlog-bijlagen')
            .createSignedUrl(row.storage_path, 3600);

          if (signErr) {
            console.warn('[Supabase] Signed URL mislukt:', signErr.message, 'pad:', row.storage_path);
            // Fallback: probeer public URL als bucket publiek is
            const { data: pub } = sb.storage.from('spuitlog-bijlagen').getPublicUrl(row.storage_path);
            if (pub?.publicUrl) {
              const res = await fetch(pub.publicUrl);
              if (res.ok) {
                const blob = await res.blob();
                const dataUrl = await new Promise(resolve => {
                  const reader = new FileReader();
                  reader.onload = e => resolve(e.target.result);
                  reader.readAsDataURL(blob);
                });
                bestand.dataUrl = dataUrl;
                if (bestand.type.startsWith('image/')) {
                  bestand.thumbnail = await compressToThumbnail(dataUrl, bestand.type);
                }
                const idbRecord = {
                  id: `${meldingId}_${row.filename}_${row.file_hash}`,
                  meldingId, name: bestand.name, type: bestand.type,
                  size: bestand.size, hash: bestand.hash,
                  thumbnail: bestand.thumbnail, dataUrl
                };
                await idbSaveBijlage(idbRecord);
              }
            }
          } else if (signed?.signedUrl) {
            const res = await fetch(signed.signedUrl);
            if (res.ok) {
              const blob   = await res.blob();
              const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(blob);
              });
              bestand.dataUrl = dataUrl;

              // Maak thumbnail voor afbeeldingen
              if (bestand.type.startsWith('image/')) {
                bestand.thumbnail = await compressToThumbnail(dataUrl, bestand.type);
              }

              // Sla op in IDB voor offline gebruik
              const idbRecord = {
                id:        `${meldingId}_${row.filename}_${row.file_hash}`,
                meldingId,
                name:      bestand.name,
                type:      bestand.type,
                size:      bestand.size,
                hash:      bestand.hash,
                thumbnail: bestand.thumbnail,
                dataUrl
              };
              await idbSaveBijlage(idbRecord);
              console.log('[Supabase] Bijlage gedownload en in IDB opgeslagen:', bestand.name);
            }
          }
        } catch (e) {
          console.warn('[Supabase] Download bijlage mislukt:', e.message, 'bestand:', bestand.name);
        }
      }

      return bestand;
    }));

    return bestanden;
  } catch (e) {
    console.warn('[Supabase] laadBijlagenVanSupabase fout:', e.message);
    return [];
  }
}
