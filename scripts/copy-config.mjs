import { copyFile, access } from 'node:fs/promises';

const source = await exists('config.json');
await copyFile(source ? 'config.json' : 'config.example.json', 'dist/config.json');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
