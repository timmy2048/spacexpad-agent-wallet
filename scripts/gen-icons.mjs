import { access } from 'node:fs/promises';
import sharp from 'sharp';

const source = 'assets/spacexpad-x-avatar.png';
await access(source);

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const background = {
  r: data[0] ?? 8,
  g: data[1] ?? 12,
  b: data[2] ?? 32,
  alpha: info.channels >= 4 ? (data[3] ?? 255) / 255 : 1,
};

for (const size of [16, 32, 48, 128]) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background, kernel: 'lanczos3' })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
}
