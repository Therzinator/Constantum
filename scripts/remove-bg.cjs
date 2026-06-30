'use strict';
const { Jimp } = require('jimp');
const path = require('path');

const iconsDir = path.join(__dirname, '../src/assets/app-icon');
const files = ['icon_16px.png', 'icon_32px.png', 'icon_large.png', 'icon_title.png'];
const TOLERANCE = 60;

function colorDiff(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

async function removeBg(filePath) {
  const img = await Jimp.read(filePath);
  const { width, height, data } = img.bitmap;

  // Sample background color from top-left corner
  const bgIdx = 0;
  const bgR = data[bgIdx], bgG = data[bgIdx + 1], bgB = data[bgIdx + 2];

  const visited = new Uint8Array(width * height);
  const queue = [];

  // Seed from all 4 corners
  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]
  ];
  for (const [cx, cy] of corners) {
    const idx = cy * width + cx;
    if (!visited[idx]) {
      visited[idx] = 1;
      queue.push(cx, cy);
    }
  }

  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++];
    const y = queue[qi++];

    const pixIdx = (y * width + x) * 4;
    data[pixIdx + 3] = 0; // transparent

    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (visited[ni]) continue;
      visited[ni] = 1;
      const nPixIdx = ni * 4;
      const r = data[nPixIdx], g = data[nPixIdx + 1], b = data[nPixIdx + 2];
      if (colorDiff(r, g, b, bgR, bgG, bgB) <= TOLERANCE) {
        queue.push(nx, ny);
      }
    }
  }

  await img.write(filePath);
  console.log(`Klaar: ${path.basename(filePath)}`);
}

(async () => {
  for (const file of files) {
    const fp = path.join(iconsDir, file);
    try {
      await removeBg(fp);
    } catch (e) {
      console.error(`Fout bij ${file}: ${e.message}`);
    }
  }
  console.log('Alle afbeeldingen verwerkt.');
})();
