import { useEffect, useState } from 'react';
import type { Store } from '../../shared/types.ts';
import { hydrateConfig, loadStore, subscribeStore } from '../lib/storage.ts';

export function useExtensionStore(): Store | null {
  const [store, setStore] = useState<Store | null>(null);
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      await hydrateConfig();
      const next = await loadStore();
      if (alive) setStore(next);
    };
    void pull();
    const stop = subscribeStore((next) => {
      if (alive) setStore(next);
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);
  return store;
}
