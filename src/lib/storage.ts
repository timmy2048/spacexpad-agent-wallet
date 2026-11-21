import { DEFAULT_RPCS } from '../../shared/chains.ts';
import { defaultStore, normalizeStore } from '../../shared/store.ts';
import type { Settings, Store } from '../../shared/types.ts';

const KEY = 'spacexpad';

type FileConfig = {
  privyAppId?: string;
  privyClientId?: string;
  bridgeUrl?: string;
  bridgeToken?: string;
  rpc?: Record<string, string>;
};

export async function loadStore(): Promise<Store> {
  return withLock(async () => readRaw());
}

export async function updateStore(patch: (store: Store) => Store): Promise<Store> {
  return withLock(async () => {
    const next = patch(await readRaw());
    await writeRaw(next);
    return next;
  });
}

export async function hydrateConfig(): Promise<void> {
  let file: FileConfig | null = null;
  let configError: string | null = null;
  try {
    const response = await fetch(chrome.runtime.getURL('config.json'));
    if (response.ok) file = (await response.json()) as FileConfig;
  } catch (error) {
    configError = error instanceof Error ? error.message : 'Could not read config.json.';
  }
  await updateStore((store) => {
    if (store.settings.hydrated) return store;
    const settings: Settings = {
      ...store.settings,
      hydrated: true,
      privyAppId: cleanId(file?.privyAppId) || store.settings.privyAppId,
      privyClientId: cleanId(file?.privyClientId),
      bridgeUrl: file?.bridgeUrl?.trim() || store.settings.bridgeUrl,
      bridgeToken: file?.bridgeToken?.trim() || store.settings.bridgeToken,
      rpc: { ...DEFAULT_RPCS, ...file?.rpc },
      configError,
    };
    return { ...store, settings };
  });
}

export function subscribeStore(onChange: (store: Store) => void): () => void {
  const area = chromeStorage();
  if (area?.onChanged) {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, name: string) => {
      if (name !== 'local' || !changes[KEY]) return;
      onChange(normalizeStore(changes[KEY].newValue));
    };
    area.onChanged.addListener(listener);
    return () => area.onChanged.removeListener(listener);
  }

  const listener = (message: { type?: string; store?: unknown }) => {
    if (message?.type !== 'STORE_CHANGED') return;
    onChange(normalizeStore(message.store));
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

async function readRaw(): Promise<Store> {
  const local = chromeStorage()?.local;
  if (local) {
    const data = await local.get(KEY);
    return normalizeStore(data[KEY] ?? defaultStore());
  }
  const value = await chrome.runtime.sendMessage({ type: 'STORE_GET' });
  return normalizeStore(value ?? defaultStore());
}

async function writeRaw(store: Store): Promise<void> {
  const local = chromeStorage()?.local;
  if (local) {
    await local.set({ [KEY]: store });
    return;
  }
  await chrome.runtime.sendMessage({ type: 'STORE_SET', store });
}

function chromeStorage(): typeof chrome.storage | undefined {
  return globalThis.chrome?.storage;
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('spacexpad-store', fn);
  }
  return fn();
}

function cleanId(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed.includes('YOUR_PRIVY')) return '';
  return trimmed;
}

export async function bridgePost(settings: Settings, path: string, body: unknown): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${settings.bridgeUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${settings.bridgeToken}`,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new Error('The agent bridge is not running.');
  }
  const text = await response.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (response.status === 401) throw new Error('Bridge token was rejected.');
  if (!response.ok) throw new Error(typeof json.error === 'string' ? json.error : `Bridge error ${response.status}.`);
  return json;
}
