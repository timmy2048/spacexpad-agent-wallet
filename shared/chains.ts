import type { ChainId, NetworkId } from './types.ts';
import { CHAIN_ORDER } from './types.ts';

export type Cluster = {
  chain: ChainId;
  network: NetworkId;
  chainId: number | null;
  nativeSymbol: string;
  nativeDecimals: number;
  addressKind: 'solana' | 'evm';
  rpcKey: string;
  clusterName: string;
  blockscout: string | null;
  priceId: string;
};

// Solana Labs' public mainnet RPC returns HTTP 403 "Access forbidden" when the
// request carries a browser Origin, which every extension fetch does. Devnet
// still accepts that Origin. PublicNode answers getBalance from the extension.
export const SOLANA_BROWSER_MAINNET_RPC = 'https://solana-rpc.publicnode.com';

const LABS_SOLANA_MAINNET = new Set([
  'https://api.mainnet-beta.solana.com',
  'https://api.mainnet.solana.com',
]);

export const DEFAULT_RPCS: Record<string, string> = {
  'solana:mainnet': SOLANA_BROWSER_MAINNET_RPC,
  'solana:devnet': 'https://api.devnet.solana.com',
  'ethereum:mainnet': 'https://ethereum-rpc.publicnode.com',
  'ethereum:testnet': 'https://ethereum-sepolia-rpc.publicnode.com',
  'base:mainnet': 'https://base-rpc.publicnode.com',
  'base:testnet': 'https://base-sepolia-rpc.publicnode.com',
  'bnb:mainnet': 'https://bsc-rpc.publicnode.com',
  'bnb:testnet': 'https://bsc-testnet-rpc.publicnode.com',
};

const CLUSTERS: Record<string, Cluster> = {
  'solana:mainnet': {
    chain: 'solana',
    network: 'mainnet',
    chainId: null,
    nativeSymbol: 'SOL',
    nativeDecimals: 9,
    addressKind: 'solana',
    rpcKey: 'solana:mainnet',
    clusterName: 'Mainnet',
    blockscout: null,
    priceId: 'coingecko:solana',
  },
  'solana:devnet': {
    chain: 'solana',
    network: 'devnet',
    chainId: null,
    nativeSymbol: 'SOL',
    nativeDecimals: 9,
    addressKind: 'solana',
    rpcKey: 'solana:devnet',
    clusterName: 'Devnet',
    blockscout: null,
    priceId: 'coingecko:solana',
  },
  'ethereum:mainnet': {
    chain: 'ethereum',
    network: 'mainnet',
    chainId: 1,
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    addressKind: 'evm',
    rpcKey: 'ethereum:mainnet',
    clusterName: 'Mainnet',
    blockscout: 'https://eth.blockscout.com',
    priceId: 'coingecko:ethereum',
  },
  'ethereum:testnet': {
    chain: 'ethereum',
    network: 'testnet',
    chainId: 11155111,
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    addressKind: 'evm',
    rpcKey: 'ethereum:testnet',
    clusterName: 'Sepolia',
    blockscout: 'https://eth-sepolia.blockscout.com',
    priceId: 'coingecko:ethereum',
  },
  'base:mainnet': {
    chain: 'base',
    network: 'mainnet',
    chainId: 8453,
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    addressKind: 'evm',
    rpcKey: 'base:mainnet',
    clusterName: 'Mainnet',
    blockscout: 'https://base.blockscout.com',
    priceId: 'coingecko:ethereum',
  },
  'base:testnet': {
    chain: 'base',
    network: 'testnet',
    chainId: 84532,
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    addressKind: 'evm',
    rpcKey: 'base:testnet',
    clusterName: 'Base Sepolia',
    blockscout: 'https://base-sepolia.blockscout.com',
    priceId: 'coingecko:ethereum',
  },
  'bnb:mainnet': {
    chain: 'bnb',
    network: 'mainnet',
    chainId: 56,
    nativeSymbol: 'BNB',
    nativeDecimals: 18,
    addressKind: 'evm',
    rpcKey: 'bnb:mainnet',
    clusterName: 'Mainnet',
    blockscout: null,
    priceId: 'coingecko:binancecoin',
  },
  'bnb:testnet': {
    chain: 'bnb',
    network: 'testnet',
    chainId: 97,
    nativeSymbol: 'BNB',
    nativeDecimals: 18,
    addressKind: 'evm',
    rpcKey: 'bnb:testnet',
    clusterName: 'BSC testnet',
    blockscout: null,
    priceId: 'coingecko:binancecoin',
  },
};

export function browserRpcUrl(chain: ChainId, network: NetworkId, configured: string): string {
  const url = configured.trim().replace(/\/+$/, '');
  if (chain === 'solana' && network === 'mainnet' && LABS_SOLANA_MAINNET.has(url)) return SOLANA_BROWSER_MAINNET_RPC;
  return url;
}

export function isChainId(value: string): value is ChainId {
  return (CHAIN_ORDER as readonly string[]).includes(value);
}

export function resolveCluster(chain: ChainId, network?: string | null): Cluster {
  const requested = (network ?? '').trim().toLowerCase();
  const selected = requested.length === 0 ? 'mainnet' : requested;
  if (chain === 'solana') {
    if (selected === 'testnet') {
      throw new Error('Solana does not use "testnet" here. Omit network for mainnet, or pass "devnet".');
    }
    if (selected !== 'mainnet' && selected !== 'devnet') {
      throw new Error('Pass "devnet" for Solana test traffic, or omit network to use mainnet.');
    }
  } else if (selected === 'devnet') {
    throw new Error(`${chain} has no devnet here. Omit network for mainnet, or pass "testnet".`);
  } else if (selected !== 'mainnet' && selected !== 'testnet') {
    throw new Error('Omit network to use mainnet, or pass "testnet".');
  }
  const cluster = CLUSTERS[`${chain}:${selected}`];
  if (!cluster) throw new Error(`Unsupported chain ${chain}.`);
  return cluster;
}

export function chainMeta(chain: ChainId): { name: string; nativeSymbol: string; nativeDecimals: number } {
  const cluster = CLUSTERS[`${chain}:${chain === 'solana' ? 'mainnet' : 'mainnet'}`];
  return {
    name: chain === 'solana' ? 'Solana' : chain === 'ethereum' ? 'Ethereum' : chain === 'base' ? 'Base' : 'BNB Chain',
    nativeSymbol: cluster.nativeSymbol,
    nativeDecimals: cluster.nativeDecimals,
  };
}

export function llamaChain(chain: ChainId): string {
  if (chain === 'ethereum') return 'ethereum';
  if (chain === 'base') return 'base';
  if (chain === 'bnb') return 'bsc';
  return 'solana';
}
