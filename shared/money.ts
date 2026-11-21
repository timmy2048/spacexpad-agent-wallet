export function usdToMicro(usd: number): bigint {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('Invalid USD amount.');
  return BigInt(Math.round(usd * 1_000_000));
}

export function formatUsd(micro: bigint): string {
  const neg = micro < 0n;
  const value = neg ? -micro : micro;
  const whole = value / 1_000_000n;
  const frac = (value % 1_000_000n).toString().padStart(6, '0').slice(0, 2);
  return `${neg ? '-' : ''}${whole.toString()}.${frac}`;
}

export function rawToMicroUsd(raw: bigint, decimals: number, priceUsd: number): bigint {
  if (!Number.isFinite(priceUsd) || priceUsd < 0) throw new Error('Invalid token price.');
  const priceMicro = BigInt(Math.round(priceUsd * 1_000_000));
  const scale = 10n ** BigInt(decimals);
  return (raw * priceMicro) / scale;
}

export function formatRaw(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  const value = neg ? -raw : raw;
  const text = value.toString().padStart(decimals + 1, '0');
  const whole = text.slice(0, text.length - decimals);
  const frac = text.slice(text.length - decimals).replace(/0+$/, '');
  const amount = frac ? `${whole}.${frac}` : whole;
  return neg ? `-${amount}` : amount;
}

export function displayAmount(amount: string): string {
  const [whole, frac] = amount.split('.');
  if (!frac) return whole;
  const cut = frac.slice(0, 6).replace(/0+$/, '');
  return cut ? `${whole}.${cut}` : whole;
}

export function parseDecimal(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error('Amount must be a positive decimal.');
  const [whole, frac = ''] = amount.split('.');
  if (frac.length > decimals) throw new Error('Amount has too many decimal places.');
  const raw = BigInt(whole + frac.padEnd(decimals, '0'));
  if (raw <= 0n) throw new Error('Amount must be greater than zero.');
  return raw;
}

export function utcDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function truncateAddress(address: string, kind: 'evm' | 'solana'): string {
  if (kind === 'evm') return `${address.slice(0, 6)}...${address.slice(-4)}`;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function sameAddress(left: string, right: string): boolean {
  if (left.startsWith('0x') || left.startsWith('0X') || right.startsWith('0x') || right.startsWith('0X')) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export function isAllowlistAddress(value: string): boolean {
  return isEvmAddress(value) || isSolanaAddress(value);
}
