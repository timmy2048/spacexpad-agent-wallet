import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = ['src', 'shared', 'mcp', 'scripts'];
const banned = ['.then(', 'eval(', 'new Function', 'onclick=', 'javascript:'];
const offenders = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.name === 'check-constraints.mjs') continue;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      await walk(path);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|html|css)$/.test(entry.name)) continue;
    const text = await readFile(path, 'utf8');
    for (const token of banned) {
      if (text.includes(token)) offenders.push(`${path} contains ${token}`);
    }
  }
}

for (const root of roots) await walk(root);
if (offenders.length) {
  console.error(offenders.join('\n'));
  process.exit(1);
}
