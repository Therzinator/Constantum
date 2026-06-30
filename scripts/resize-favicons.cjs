'use strict';
const { Jimp } = require('jimp');
const path = require('path');

const src = path.join(__dirname, '../src/assets/app-icon/icon_large.png');
const publicIcons = path.join(__dirname, '../public/icons');

const targets = [
  { size: 16,  out: path.join(publicIcons, 'icon_16px.png') },
  { size: 32,  out: path.join(publicIcons, 'icon_32px.png') },
  { size: 180, out: path.join(publicIcons, 'apple-touch-icon.png') },
  { size: 192, out: path.join(publicIcons, 'icon-192.png') },
  { size: 512, out: path.join(publicIcons, 'icon-512.png') },
];

(async () => {
  const img = await Jimp.read(src);
  for (const { size, out } of targets) {
    const copy = img.clone();
    copy.resize({ w: size, h: size });
    await copy.write(out);
    console.log(`${size}x${size} → ${path.basename(out)}`);
  }
  console.log('Klaar.');
})();
