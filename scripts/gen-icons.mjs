import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('public/icons', { recursive: true });
const svg = await readFile('assets/rocket.svg');
for (const size of [16, 48, 128]) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { kernel: 'nearest', fit: 'fill' })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
}
