'use strict';
const { Jimp } = require('jimp');
const path = require('path');

const iconsDir = path.join(__dirname, '../src/assets/app-icon');
const publicIcons = path.join(__dirname, '../public/icons');

async function cropToBoundingBox(filePath) {
  const img = await Jimp.read(filePath);
  const { width, height, data } = img.bitmap;

  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const side = Math.max(cropW, cropH);

  // Center the crop in a square canvas
  const offsetX = Math.round((side - cropW) / 2);
  const offsetY = Math.round((side - cropH) / 2);

  const cropped = new Jimp({ width: side, height: side, color: 0x00000000 });
  img.crop({ x: minX, y: minY, w: cropW, h: cropH });
  cropped.composite(img, offsetX, offsetY);

  return cropped;
}

(async () => {
  const src = path.join(iconsDir, 'icon_32px.png');
  const cropped = await cropToBoundingBox(src);

  // Sla cropped op als nieuw bronbestand
  const croppedPath = path.join(iconsDir, 'icon_cropped.png');
  await cropped.write(croppedPath);
  console.log(`icon_cropped.png: ${cropped.width}x${cropped.height}px`);

  // Maak favicon-maten vanuit de strak gecropte versie
  const sizes = [
    { size: 16,  out: path.join(publicIcons, 'icon_16px.png') },
    { size: 32,  out: path.join(publicIcons, 'icon_32px.png') },
    { size: 180, out: path.join(publicIcons, 'apple-touch-icon.png') },
    { size: 192, out: path.join(publicIcons, 'icon-192.png') },
    { size: 512, out: path.join(publicIcons, 'icon-512.png') },
  ];

  for (const { size, out } of sizes) {
    const copy = cropped.clone();
    copy.resize({ w: size, h: size });
    await copy.write(out);
    console.log(`  ${size}x${size} → ${path.basename(out)}`);
  }

  console.log('Klaar.');
})();
