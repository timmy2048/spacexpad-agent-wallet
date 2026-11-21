import { decodeFunctionData, erc20Abi, type Hex, parseTransaction } from 'viem';

export type EvmCall = {
  to: `0x${string}` | null;
  value: bigint;
  data: Hex;
  token: { contract: `0x${string}`; raw: bigint } | null;
  pricedFromNative: boolean;
  recognized: boolean;
};

const TRANSFER = '0xa9059cbb';

export function evmCallFromSerialized(serialized: string): EvmCall {
  const hex = asHex(serialized);
  const tx = parseTransaction(hex);
  const data = (tx.data ?? '0x') as Hex;
  const value = tx.value ?? 0n;
  const to = tx.to ?? null;
  if (to && data.startsWith(TRANSFER) && data.length >= 10 + 64 + 64) {
    try {
      const decoded = decodeFunctionData({ abi: erc20Abi, data });
      if (decoded.functionName === 'transfer') {
        const raw = decoded.args[1];
        return {
          to,
          value,
          data,
          token: { contract: to, raw },
          pricedFromNative: value > 0n,
          recognized: true,
        };
      }
    } catch {
      // Fall through to the generic call path.
    }
  }
  const emptyData = data === '0x' || data === '0x0';
  return {
    to,
    value,
    data,
    token: null,
    pricedFromNative: true,
    recognized: emptyData,
  };
}

export function evmDestinations(call: EvmCall): string[] | null {
  if (!call.to) return null;
  return [call.to];
}

function asHex(serialized: string): Hex {
  const trimmed = serialized.trim();
  if (trimmed.startsWith('0x')) return trimmed as Hex;
  const bytes = Uint8Array.from(atob(trimmed), (char) => char.charCodeAt(0));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}
