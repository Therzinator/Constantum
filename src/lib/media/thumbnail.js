import { byteSize } from '../../utils/format.js';

// ── Thumbnail compressie ─────────────────────────────────────
const THUMB_MAX_PX   = 800;
const THUMB_QUALITY  = 0.65;
const THUMB_MAX_BYTES = 200 * 1024; // 200 KB

export async function compressToThumbnail(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > THUMB_MAX_PX || height > THUMB_MAX_PX) {
        const ratio = Math.min(THUMB_MAX_PX / width, THUMB_MAX_PX / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const thumb = canvas.toDataURL('image/jpeg', THUMB_QUALITY);
      // Gooi thumbnail weg als nog te groot (bv. bij getransparante PNG)
      resolve(byteSize(thumb) <= THUMB_MAX_BYTES ? thumb : null);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
