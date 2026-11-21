import { useEffect, useState } from 'react';
import { displayNetwork } from '../../shared/assets.ts';
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
  const view = store.assetView ?? 'mainnet';
  const rpcKey = CHAIN_ORDER.map((chain) => {
    const network = displayNetwork(chain, view);
    return store.settings.rpc[`${chain}:${network}`] ?? '';
  }).join('|');

  useEffect(() => {
    if (!ready) {
      setPending(false);
      return;
    }
    let cancel = false;
    const run = async () => {
      setPending(true);
      const snaps = await Promise.all(CHAIN_ORDER.map(async (chain) => readOne(store, chain, view)));
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
  }, [ready, solana, evm, rpcKey, nonce, view]);

  return { pending, refresh: () => setNonce((value) => value + 1) };
}

async function readOne(store: Store, chain: ChainId, view: Store['assetView']): Promise<Snapshot> {
  const network = displayNetwork(chain, view);
  const cluster = resolveCluster(chain, network);
  const rpcUrl = browserRpcUrl(chain, network, store.settings.rpc[cluster.rpcKey] ?? '');
  if (!rpcUrl) return failed(chain, network, `No RPC is configured for ${cluster.rpcKey}.`);
  try {
    return await readClusterBalance({
      chain,
      network,
      solanaAddress: store.addresses?.solana ?? null,
      evmAddress: store.addresses?.evm ?? null,
      rpcUrl,
      now: Date.now(),
    });
  } catch (error) {
    return failed(chain, network, error instanceof Error ? error.message : 'Balance could not be loaded.');
  }
}

function failed(chain: ChainId, network: Snapshot['network'], error: string): Snapshot {
  return {
    chain,
    network,
    status: 'error',
    error,
    tokenListError: null,
    assets: [],
    readAt: Date.now(),
  };
}
