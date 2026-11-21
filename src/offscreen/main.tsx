import '../buffer-polyfill.ts';
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { hasAppId } from '../../shared/store.ts';
import type { Inbound } from '../../shared/types.ts';
import { handleAgentRequest } from '../lib/handleRequest.ts';
import { bridgePost, loadStore, updateStore } from '../lib/storage.ts';
import { PrivyGate, useVault } from '../privy/useVault.tsx';
import { useExtensionStore } from '../popup/useStore.ts';

function Offscreen() {
  const store = useExtensionStore();
  useEffect(() => {
    localStorage.setItem('spacexpad-offscreen', new Date().toISOString());
  }, []);
  useEffect(() => {
    const listener = (message: { type?: string }, sender: chrome.runtime.MessageSender) => {
      if (sender.id !== chrome.runtime.id) return;
      if (message?.type === 'AUTH_CHANGED') location.reload();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
  if (!store || !hasAppId(store.settings)) return null;
  return (
    <PrivyGate appId={store.settings.privyAppId} clientId={store.settings.privyClientId}>
      <BridgeLoop />
    </PrivyGate>
  );
}

function BridgeLoop() {
  const { sign } = useVault();
  const signRef = useRef(sign);
  signRef.current = sign;
  useEffect(() => {
    let stopped = false;
    const loop = async () => {
      while (!stopped) {
        const store = await loadStore();
        if (!store.settings.bridgeToken) {
          await sleep(2000);
          continue;
        }
        try {
          const json = await bridgePost(store.settings, '/v1/wait', {});
          if (stopped) return;
          await updateStore((current) => ({
            ...current,
            bridge: { connected: true, error: null, at: Date.now() },
          }));
          const request = json.request as Inbound | null | undefined;
          if (!request) continue;
          const result = await handleAgentRequest(
            {
              load: loadStore,
              update: updateStore,
              sign: (params, rpcUrl, method) => signRef.current(params, rpcUrl, method),
              confirm: async (id) => {
                const latest = await loadStore();
                const answer = await bridgePost(latest.settings, '/v1/confirm', { id });
                return answer.proceed === true;
              },
              now: () => Date.now(),
            },
            request,
          );
          const latest = await loadStore();
          await bridgePost(latest.settings, '/v1/result', { id: request.id, ...result });
        } catch (error) {
          if (stopped) return;
          const message = error instanceof Error ? error.message : 'Bridge not connected';
          await updateStore((current) => ({
            ...current,
            bridge: { connected: false, error: message, at: Date.now() },
          }));
          await sleep(2000);
        }
      }
    };
    void loop();
    return () => {
      stopped = true;
    };
  }, []);
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

createRoot(document.getElementById('root') as HTMLElement).render(<Offscreen />);
