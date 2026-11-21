import { useEffect, useState } from 'react';
import { browserRpcUrl, resolveCluster } from '../../shared/chains.ts';
import { CHAIN_ORDER, type ChainId, type Snapshot, type Store } from '../../shared/types.ts';
import { readClusterBalance } from '../lib/balances.ts';
import { updateStore } from '../lib/storage.ts';

export function useMainnetBalances(store: Store): { pending: boolean; refresh: () => void } {
  const ready = Boolean(store.addresses?.solana || store.addresses?.evm);
  const [pending, setPending] = useState(ready);
  const [nonce, setNonce] = useState(0);
  const solana = store.addresses?.solana ?? '';
  const evm = store.addresses?.evm ?? '';
  const rpcKey = CHAIN_ORDER.map((chain) => store.settings.rpc[`${chain}:mainnet`] ?? '').join('|');

  useEffect(() => {
    if (!ready) {
      setPending(false);
      return;
    }
    let cancel = false;
    const run = async () => {
      setPending(true);
      const snaps = await Promise.all(CHAIN_ORDER.map(async (chain) => readOne(store, chain)));
      if (cancel) return;
      await updateStore((current) => {
        let next = current;
        for (const snap of snaps) {
          next = {
            ...next,
            snapshots: [...next.snapshots.filter((item) => item.chain !== snap.chain || item.network !== snap.network), snap],
          };
        }
        return next;
      });
      if (!cancel) setPending(false);
    };
    void run();
    return () => {
      cancel = true;
    };
  }, [ready, solana, evm, rpcKey, nonce]);

  return { pending, refresh: () => setNonce((value) => value + 1) };
}

async function readOne(store: Store, chain: ChainId): Promise<Snapshot> {
  const cluster = resolveCluster(chain, 'mainnet');
  const rpcUrl = browserRpcUrl(chain, 'mainnet', store.settings.rpc[cluster.rpcKey] ?? '');
  if (!rpcUrl) return failed(chain, `No RPC is configured for ${cluster.rpcKey}.`);
  try {
    return await readClusterBalance({
      chain,
      network: 'mainnet',
      solanaAddress: store.addresses?.solana ?? null,
      evmAddress: store.addresses?.evm ?? null,
      rpcUrl,
      now: Date.now(),
    });
  } catch (error) {
    return failed(chain, error instanceof Error ? error.message : 'Balance could not be loaded.');
  }
}

function failed(chain: ChainId, error: string): Snapshot {
  return {
    chain,
    network: 'mainnet',
    status: 'error',
    error,
    tokenListError: null,
    assets: [],
    readAt: Date.now(),
  };
}
