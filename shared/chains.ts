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

export const DEFAULT_RPCS: Record<string, string> = {
  'solana:mainnet': 'https://api.mainnet-beta.solana.com',
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
    blockscout: 'https://bsc.blockscout.com',
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
    blockscout: 'https://bsc-testnet.blockscout.com',
    priceId: 'coingecko:binancecoin',
  },
};

export function isChainId(value: string): value is ChainId {
  return (CHAIN_ORDER as readonly string[]).includes(value);
}

export function resolveCluster(chain: ChainId, network: string): Cluster {
  if (chain === 'solana') {
    if (network === 'testnet') {
      throw new Error(
        'Solana has no default cluster. Pass network "devnet" or "mainnet". "testnet" is not used.',
      );
    }
    if (network !== 'mainnet' && network !== 'devnet') {
      throw new Error('Pass network "mainnet" or "devnet" for Solana. There is no default.');
    }
  } else if (network === 'devnet') {
    throw new Error(
      `${chain} has no devnet here. Pass network "mainnet" or "testnet". There is no default.`,
    );
  } else if (network !== 'mainnet' && network !== 'testnet') {
    throw new Error('Pass network "mainnet" or "testnet". There is no default.');
  }
  const cluster = CLUSTERS[`${chain}:${network}`];
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
