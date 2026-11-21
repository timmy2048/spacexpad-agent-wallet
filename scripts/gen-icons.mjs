import { access } from 'node:fs/promises';
import sharp from 'sharp';

const source = 'assets/spacexpad-x-avatar.png';
let present = true;
try {
  await access(source);
} catch {
  present = false;
}

if (!present) {
  console.error(`Missing ${source}. Icons were not redrawn, and assets/rocket.svg is not a source.`);
  await sharp('public/icons/icon-128.png').resize(32, 32).png().toFile('public/icons/icon-32.png');
  process.exit(0);
}

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const background = {
  r: data[0] ?? 8,
  g: data[1] ?? 12,
  b: data[2] ?? 32,
  alpha: info.channels >= 4 ? (data[3] ?? 255) / 255 : 1,
};

for (const size of [16, 32, 48, 128]) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
}
