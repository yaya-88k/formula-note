// One-time icon generator: converts icons/icon.svg into the PNGs the manifest needs.
// Usage: node tools/generate-icons.mjs

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'icons', 'icon.svg');

async function gen(size, filename, opts = {}) {
  let pipeline = sharp(svgPath, { density: 600 }).resize(size, size);
  if (opts.padding) {
    // For maskable icon, shrink content and add background so safe-area is respected.
    const inner = Math.round(size * 0.78);
    pipeline = sharp(svgPath, { density: 600 })
      .resize(inner, inner)
      .extend({
        top: Math.floor((size - inner) / 2),
        bottom: Math.ceil((size - inner) / 2),
        left: Math.floor((size - inner) / 2),
        right: Math.ceil((size - inner) / 2),
        background: { r: 0x3a, g: 0x7f, b: 0xc1, alpha: 1 },
      });
  }
  const out = path.join(root, 'icons', filename);
  await pipeline.png().toFile(out);
  console.log(`wrote ${filename}`);
}

await gen(192, 'icon-192.png');
await gen(512, 'icon-512.png');
await gen(512, 'icon-maskable-512.png', { padding: true });
console.log('done');
