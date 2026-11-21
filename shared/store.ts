import { DEFAULT_RPCS } from './chains.ts';
import type { Settings, Store } from './types.ts';
import { DEFAULT_POLICY } from './types.ts';

export const BRIDGE_URL = 'http://127.0.0.1:47321';

export function defaultSettings(): Settings {
  return {
    hydrated: false,
    privyAppId: '',
    privyClientId: '',
    bridgeUrl: BRIDGE_URL,
    bridgeToken: '',
    rpc: { ...DEFAULT_RPCS },
    configError: null,
  };
}

export function defaultStore(): Store {
  return {
    version: 1,
    language: 'en',
    username: '',
    auth: null,
    addresses: null,
    policy: { ...DEFAULT_POLICY, whitelist: [] },
    agents: [],
    activity: [],
    spend: { date: '', microUsd: '0' },
    snapshots: [],
    pair: null,
    pendingApproval: null,
    approval: null,
    settings: defaultSettings(),
    bridge: { connected: false, error: null, at: null },
    vaultError: null,
  };
}

export function normalizeStore(value: unknown): Store {
  const base = defaultStore();
  if (!value || typeof value !== 'object') return base;
  const raw = value as Partial<Store>;
  const settings = raw.settings ?? base.settings;
  return {
    ...base,
    ...raw,
    version: 1,
    policy: { ...base.policy, ...raw.policy, whitelist: raw.policy?.whitelist ?? [] },
    agents: raw.agents ?? [],
    activity: raw.activity ?? [],
    snapshots: raw.snapshots ?? [],
    spend: raw.spend ?? base.spend,
    settings: {
      ...base.settings,
      ...settings,
      rpc: { ...DEFAULT_RPCS, ...settings.rpc },
    },
    pendingApproval: pendingShape(raw.pendingApproval) ? raw.pendingApproval : null,
    approval: approvalShape(raw.approval) ? raw.approval : null,
    bridge: { ...base.bridge, ...raw.bridge },
    vaultError: raw.vaultError ?? null,
  };
}

function pendingShape(value: Store['pendingApproval'] | undefined): value is NonNullable<Store['pendingApproval']> {
  return Boolean(value && typeof value.id === 'string' && (value.method === 'sign' || value.method === 'send'));
}

function approvalShape(value: Store['approval'] | undefined): value is NonNullable<Store['approval']> {
  return Boolean(value && typeof value.id === 'string' && typeof value.allow === 'boolean');
}

export function isDisplayName(value: string): boolean {
  return /^[\p{L}\p{N}_]{2,24}$/u.test(value);
}

export function hasAppId(settings: Settings): boolean {
  const id = settings.privyAppId.trim();
  return id.length > 8 && !id.includes('YOUR_PRIVY');
}
