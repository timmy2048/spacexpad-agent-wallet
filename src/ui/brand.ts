export function brandIcon(px: 32 | 48 | 128 = 32): string {
  const file = `icons/icon-${px}.png`;
  const runtime = globalThis.chrome?.runtime;
  if (runtime && typeof runtime.getURL === 'function') return runtime.getURL(file);
  return `/${file}`;
}
