import { browserRpcUrl, llamaChain, resolveCluster } from '../../shared/chains.ts';
import { formatUsd, rawToMicroUsd } from '../../shared/money.ts';
import { nativeAsset, parseBinplorerTokens, parseBlockscoutTokens, parseJupiterHoldings, parseSolanaTokenAccounts } from '../../shared/assets.ts';
import type { Asset, ChainId, NetworkId, Snapshot } from '../../shared/types.ts';

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export async function readClusterBalance(input: {
  chain: ChainId;
  network: string;
  solanaAddress: string | null;
  evmAddress: string | null;
  rpcUrl: string;
  now: number;
}): Promise<Snapshot> {
  const cluster = resolveCluster(input.chain, input.network);
  const address = cluster.addressKind === 'solana' ? input.solanaAddress : input.evmAddress;
  if (!address) throw new Error('Wallets are not ready yet.');
  const rpcUrl = browserRpcUrl(cluster.chain, cluster.network, input.rpcUrl);
  try {
    const nativeRaw =
      cluster.chain === 'solana'
        ? await solanaLamports(rpcUrl, address)
        : await evmBalance(rpcUrl, address);
    const native = nativeAsset(cluster.chain, nativeRaw);
    native.usd = await nativeUsd(cluster.priceId, nativeRaw, cluster.nativeDecimals);
    let tokens: Asset[] = [];
    let tokenListError: string | null = null;
    try {
      tokens =
        cluster.chain === 'solana'
          ? await solanaTokens(rpcUrl, address, cluster.network)
          : await evmTokens(cluster.chain, cluster.network, cluster.blockscout, address);
      await attachTokenPrices(cluster.chain, tokens);
    } catch (error) {
      tokenListError = error instanceof Error ? error.message : 'Token list could not be loaded.';
    }
    return {
      chain: cluster.chain,
      network: cluster.network,
      status: 'ready',
      error: null,
      tokenListError,
      assets: [native, ...tokens],
      readAt: input.now,
    };
  } catch (error) {
    return {
      chain: cluster.chain,
      network: cluster.network as NetworkId,
      status: 'error',
      error: error instanceof Error ? error.message : 'Balance could not be loaded.',
      tokenListError: null,
      assets: [],
      readAt: input.now,
    };
  }
}

async function solanaLamports(rpcUrl: string, address: string): Promise<bigint> {
  const json = await rpc(rpcUrl, 'getBalance', [address]);
  const value = (json as { result?: { value?: number } }).result?.value;
  if (typeof value !== 'number') throw new Error('Solana balance response was not usable.');
  return BigInt(value);
}

async function solanaTokens(rpcUrl: string, address: string, network: NetworkId): Promise<Asset[]> {
  try {
    return await solanaTokenAccounts(rpcUrl, address);
  } catch (error) {
    if (network !== 'mainnet') throw error;
    try {
      return await jupiterHoldings(address);
    } catch (fallback) {
      const first = error instanceof Error ? error.message : 'Token list could not be loaded.';
      const second = fallback instanceof Error ? fallback.message : 'Token list could not be loaded.';
      throw new Error(`${first} ${second}`);
    }
  }
}

async function solanaTokenAccounts(rpcUrl: string, address: string): Promise<Asset[]> {
  const classic = await rpc(rpcUrl, 'getTokenAccountsByOwner', [
    address,
    { programId: TOKEN_PROGRAM },
    { encoding: 'jsonParsed' },
  ]);
  const next = await rpc(rpcUrl, 'getTokenAccountsByOwner', [
    address,
    { programId: TOKEN_2022 },
    { encoding: 'jsonParsed' },
  ]);
  return [...parseSolanaTokenAccounts(classic), ...parseSolanaTokenAccounts(next)];
}

async function jupiterHoldings(address: string): Promise<Asset[]> {
  const response = await fetch(`https://lite-api.jup.ag/ultra/v1/holdings/${encodeURIComponent(address)}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`Token list failed (${response.status}).`);
  return parseJupiterHoldings(JSON.parse(text) as unknown);
}

async function evmBalance(rpcUrl: string, address: string): Promise<bigint> {
  const json = await rpc(rpcUrl, 'eth_getBalance', [address, 'latest']);
  const value = (json as { result?: string }).result;
  if (typeof value !== 'string') throw new Error('EVM balance response was not usable.');
  return BigInt(value);
}

async function evmTokens(chain: ChainId, network: NetworkId, blockscout: string | null, address: string): Promise<Asset[]> {
  if (chain === 'bnb') {
    if (network !== 'mainnet') throw new Error('BNB Chain testnet token list is not available.');
    return binplorerTokens(address);
  }
  if (!blockscout) return [];
  const response = await fetch(`${blockscout}/api/v2/addresses/${address}/token-balances`);
  const text = await response.text();
  if (!response.ok) throw new Error(`Token list failed (${response.status}).`);
  return parseBlockscoutTokens(JSON.parse(text) as unknown);
}

async function binplorerTokens(address: string): Promise<Asset[]> {
  const response = await fetch(`https://api.binplorer.com/getAddressInfo/${address}?apiKey=freekey`);
  const text = await response.text();
  if (!response.ok) throw new Error(`Token list failed (${response.status}).`);
  const json = JSON.parse(text) as { error?: unknown };
  if (json.error) throw new Error('Token list could not be loaded.');
  return parseBinplorerTokens(json);
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} failed (${response.status}).`);
  const json = JSON.parse(text) as { error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || `${method} failed.`);
  return json;
}

async function nativeUsd(priceId: string, raw: bigint, decimals: number): Promise<string | null> {
  const prices = await fetchPrices([priceId]);
  const price = prices[priceId];
  if (price === undefined) return null;
  return formatUsd(rawToMicroUsd(raw, decimals, price));
}

function priceContract(contract: string): string {
  return contract.startsWith('0x') ? contract.toLowerCase() : contract;
}

async function attachTokenPrices(chain: ChainId, assets: Asset[]): Promise<void> {
  const slug = llamaChain(chain);
  const ids = assets.flatMap((asset) => (asset.contract ? [`${slug}:${priceContract(asset.contract)}`] : []));
  if (ids.length === 0) return;
  const prices = await fetchPrices(ids);
  for (const asset of assets) {
    if (!asset.contract) continue;
    const price = prices[`${slug}:${priceContract(asset.contract)}`];
    if (price === undefined) continue;
    asset.usd = formatUsd(rawToMicroUsd(BigInt(asset.raw), asset.decimals, price));
  }
}

export async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(ids)];
  const out: Record<string, number> = {};
  for (let index = 0; index < unique.length; index += 25) {
    const batch = unique.slice(index, index + 25);
    const response = await fetch(`https://coins.llama.fi/prices/current/${batch.join(',')}`);
    if (!response.ok) continue;
    const json = (await response.json()) as { coins?: Record<string, { price?: number }> };
    for (const id of batch) {
      const price = json.coins?.[id]?.price;
      if (typeof price === 'number') out[id] = price;
    }
  }
  return out;
}

export async function priceOf(id: string): Promise<number | null> {
  const prices = await fetchPrices([id]);
  return prices[id] ?? null;
}
