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
