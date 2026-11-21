import { chainMeta } from './chains.ts';
import { formatRaw } from './money.ts';
import type { Asset, ChainId, NetworkId, Snapshot } from './types.ts';
import { CHAIN_ORDER } from './types.ts';

export type ClusterView = {
  chain: ChainId;
  network: NetworkId;
  status: 'absent' | 'ready' | 'error';
  error: string | null;
  tokenListError: string | null;
  assets: Asset[];
};

export type ChainGroup = {
  chain: ChainId;
  clusters: ClusterView[];
};

export function nativeAsset(chain: ChainId, raw: bigint): Asset {
  const meta = chainMeta(chain);
  return {
    symbol: meta.nativeSymbol,
    name: meta.nativeSymbol,
    amount: formatRaw(raw, meta.nativeDecimals),
    raw: raw.toString(),
    decimals: meta.nativeDecimals,
    contract: null,
    native: true,
    usd: null,
  };
}

export function buildAssetGroups(snapshots: Snapshot[]): ChainGroup[] {
  return CHAIN_ORDER.map((chain) => {
    const main = snapshots.find((snapshot) => snapshot.chain === chain && snapshot.network === 'mainnet');
    const extras = snapshots
      .filter((snapshot) => snapshot.chain === chain && snapshot.network !== 'mainnet')
      .sort((a, b) => networkRank(a.network) - networkRank(b.network));
    const clusters: ClusterView[] = [
      main ? viewFrom(chain, main) : absentMainnet(chain),
      ...extras.map((snapshot) => viewFrom(chain, snapshot)),
    ];
    return { chain, clusters };
  });
}

function absentMainnet(chain: ChainId): ClusterView {
  return { chain, network: 'mainnet', status: 'absent', error: null, tokenListError: null, assets: [] };
}

function viewFrom(chain: ChainId, snapshot: Snapshot): ClusterView {
  return {
    chain,
    network: snapshot.network,
    status: snapshot.status,
    error: snapshot.error,
    tokenListError: snapshot.tokenListError,
    assets: snapshot.status === 'error' ? [] : ensureNative(chain, snapshot.assets),
  };
}

function ensureNative(chain: ChainId, assets: Asset[]): Asset[] {
  const tokens = assets.filter((asset) => !asset.native && asset.raw !== '0');
  const native = assets.find((asset) => asset.native) ?? nativeAsset(chain, 0n);
  return [native, ...tokens];
}

function networkRank(network: NetworkId): number {
  if (network === 'mainnet') return 0;
  if (network === 'devnet') return 1;
  return 2;
}

type SolanaTokenJson = {
  result?: {
    value?: Array<{
      account?: {
        data?: {
          parsed?: {
            info?: {
              mint?: string;
              tokenAmount?: { amount?: string; decimals?: number; uiAmountString?: string };
            };
          };
        };
      };
    }>;
  };
};

export function parseSolanaTokenAccounts(json: unknown): Asset[] {
  const rows = (json as SolanaTokenJson).result?.value ?? [];
  const assets: Asset[] = [];
  for (const row of rows) {
    const info = row.account?.data?.parsed?.info;
    const amount = info?.tokenAmount?.amount;
    const decimals = info?.tokenAmount?.decimals;
    const mint = info?.mint;
    if (!info || !mint || amount === undefined || decimals === undefined) continue;
    if (BigInt(amount) <= 0n) continue;
    assets.push({
      symbol: `${mint.slice(0, 4)}...${mint.slice(-4)}`,
      name: mint,
      amount: info.tokenAmount?.uiAmountString || formatRaw(BigInt(amount), decimals),
      raw: amount,
      decimals,
      contract: mint,
      native: false,
      usd: null,
    });
  }
  return assets;
}

type BlockscoutRow = {
  value?: string;
  token?: {
    address?: string;
    name?: string | null;
    symbol?: string | null;
    decimals?: string | number | null;
    type?: string | null;
  };
};

const SOLANA_MINTS: Record<string, { symbol: string; name: string }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin' },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether USD' },
};

export type HomeId = 'solana' | 'evm';

export function homeChains(home: HomeId, snapshots: Snapshot[]): ChainGroup['clusters'] {
  const chains: ChainId[] = home === 'solana' ? ['solana'] : ['ethereum', 'base', 'bnb'];
  return chains.map((chain) => {
    const snapshot = snapshots.find((item) => item.chain === chain && item.network === 'mainnet');
    if (!snapshot) return absentMainnet(chain);
    if (snapshot.status === 'error') {
      return { chain, network: 'mainnet' as const, status: 'error' as const, error: snapshot.error, tokenListError: null, assets: [] };
    }
    return viewFrom(chain, snapshot);
  });
}

type JupiterRow = {
  amount?: string;
  uiAmountString?: string;
  decimals?: number;
};

export function parseJupiterHoldings(json: unknown): Asset[] {
  const tokens = (json as { tokens?: Record<string, JupiterRow[] | undefined> }).tokens ?? {};
  const assets: Asset[] = [];
  for (const [mint, rows] of Object.entries(tokens)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    let raw = 0n;
    let decimals = 0;
    let singleUi = '';
    let counted = 0;
    for (const row of rows) {
      const amount = row?.amount;
      if (typeof amount !== 'string' || !/^\d+$/.test(amount)) continue;
      const value = BigInt(amount);
      if (value <= 0n) continue;
      raw += value;
      if (Number.isInteger(row.decimals) && (row.decimals as number) >= 0 && (row.decimals as number) <= 18) {
        decimals = row.decimals as number;
      }
      if (typeof row.uiAmountString === 'string') singleUi = row.uiAmountString;
      counted += 1;
    }
    if (raw <= 0n) continue;
    const known = SOLANA_MINTS[mint];
    assets.push({
      symbol: known?.symbol ?? `${mint.slice(0, 4)}...${mint.slice(-4)}`,
      name: known?.name ?? mint,
      amount: counted === 1 && singleUi ? singleUi : formatRaw(raw, decimals),
      raw: raw.toString(),
      decimals,
      contract: mint,
      native: false,
      usd: null,
    });
  }
  return assets;
}

type BinplorerRow = {
  rawBalance?: string;
  tokenInfo?: { address?: string; decimals?: string | number | null; name?: string | null; symbol?: string | null };
};

export function parseBinplorerTokens(json: unknown): Asset[] {
  const rows = (json as { tokens?: BinplorerRow[] }).tokens ?? [];
  const assets: Asset[] = [];
  for (const row of rows) {
    const info = row.tokenInfo;
    const raw = row.rawBalance ?? '';
    if (!info?.address || !/^\d+$/.test(raw) || BigInt(raw) <= 0n) continue;
    const decimals = Number(info.decimals ?? 0);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) continue;
    const symbol = (info.symbol || '').trim() || `${info.address.slice(0, 6)}...${info.address.slice(-4)}`;
    assets.push({
      symbol,
      name: (info.name || symbol).trim(),
      amount: formatRaw(BigInt(raw), decimals),
      raw,
      decimals,
      contract: info.address,
      native: false,
      usd: null,
    });
  }
  return assets;
}

export function parseBlockscoutTokens(json: unknown): Asset[] {
  const rows = Array.isArray(json)
    ? json
    : Array.isArray((json as { items?: unknown[] })?.items)
      ? ((json as { items: unknown[] }).items)
      : [];
  const assets: Asset[] = [];
  for (const row of rows as BlockscoutRow[]) {
    const token = row.token;
    const type = (token?.type ?? '').toUpperCase();
    if (!token?.address || type.includes('721') || type === 'NATIVE') continue;
    if (type && !type.includes('20') && !type.includes('1155') && type !== 'ERC-20') continue;
    const decimals = Number(token.decimals ?? 0);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) continue;
    const raw = row.value ?? '0';
    if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) continue;
    const symbol = (token.symbol || '').trim() || `${token.address.slice(0, 6)}...${token.address.slice(-4)}`;
    assets.push({
      symbol,
      name: (token.name || symbol).trim(),
      amount: formatRaw(BigInt(raw), decimals),
      raw,
      decimals,
      contract: token.address,
      native: false,
      usd: null,
    });
  }
  return assets;
}
