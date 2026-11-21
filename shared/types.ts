export const CHAIN_ORDER = ['solana', 'ethereum', 'base', 'bnb'] as const;

export type ChainId = (typeof CHAIN_ORDER)[number];

export type NetworkId = 'mainnet' | 'testnet' | 'devnet';

export type Lang = 'en' | 'zh-CN' | 'zh-TW';

export type RiskPolicy = {
  fullAccess: boolean;
  singleTxUsd: number | null;
  dailyUsd: number | null;
  whitelistEnabled: boolean;
  whitelist: { address: string; label: string }[];
  agentsPaused: boolean;
};

export const DEFAULT_POLICY: RiskPolicy = {
  fullAccess: true,
  singleTxUsd: null,
  dailyUsd: null,
  whitelistEnabled: false,
  whitelist: [],
  agentsPaused: false,
};

export type DenialCode =
  | 'paused'
  | 'whitelist-unknown'
  | 'whitelist-empty'
  | 'whitelist-miss'
  | 'unpriced'
  | 'single-limit'
  | 'daily-limit'
  | 'limits-unset';

export type Denial = {
  code: DenialCode;
  address?: string;
  usd?: string;
  limit?: string;
  spent?: string;
};

export type Asset = {
  symbol: string;
  name: string;
  amount: string;
  raw: string;
  decimals: number;
  contract: string | null;
  native: boolean;
  usd: string | null;
};

export type Snapshot = {
  chain: ChainId;
  network: NetworkId;
  status: 'ready' | 'error';
  error: string | null;
  tokenListError: string | null;
  assets: Asset[];
  readAt: number;
};

export type BoundAgent = {
  id: string;
  name: string;
  token: string;
  boundAt: number;
};

export type Activity = {
  id: string;
  at: number;
  agentName: string;
  method: 'balance' | 'sign' | 'send' | 'sign_message';
  chain: ChainId;
  network: NetworkId;
  status: 'ok' | 'blocked' | 'error';
  detail: string;
  hash?: string;
};

export type RpcMap = Record<string, string>;

export type Settings = {
  hydrated: boolean;
  privyAppId: string;
  privyClientId: string;
  bridgeUrl: string;
  bridgeToken: string;
  rpc: RpcMap;
  configError: string | null;
};

export type PendingApproval = {
  id: string;
  method: 'sign' | 'send' | 'sign_message';
  chain: ChainId;
  network: NetworkId;
  agentName: string;
  expiresAt: number;
  message?: string;
};

export type ApprovalDecision = {
  id: string;
  allow: boolean;
};

export type AssetView = 'mainnet' | 'test';

export type Store = {
  version: 1;
  language: Lang;
  username: string;
  assetView: AssetView;
  auth: { userId: string; email: string } | null;
  addresses: { solana: string | null; evm: string | null } | null;
  policy: RiskPolicy;
  agents: BoundAgent[];
  activity: Activity[];
  spend: { date: string; microUsd: string };
  snapshots: Snapshot[];
  pair: { code: string; expiresAt: number; registered?: boolean } | null;
  pendingApproval: PendingApproval | null;
  approval: ApprovalDecision | null;
  settings: Settings;
  bridge: { connected: boolean; error: string | null; at: number | null };
  vaultError: string | null;
};

export type TxKind = 'native_transfer' | 'serialized';

export type TxParams = {
  bindToken: string;
  chain: ChainId;
  network?: string;
  kind: TxKind;
  to?: string;
  amount?: string;
  serialized?: string;
};

export type MessageEncoding = 'utf8' | 'hex' | 'base64';

export type SignMessageParams = {
  bindToken: string;
  chain: ChainId;
  network?: string;
  message: string;
  encoding?: MessageEncoding;
};

export type Inbound =
  | { id: string; method: 'get_addresses'; params: { bindToken: string } }
  | { id: string; method: 'get_balance'; params: { bindToken: string; chain: ChainId; network?: string } }
  | { id: string; method: 'sign' | 'send'; params: TxParams }
  | { id: string; method: 'sign_message'; params: SignMessageParams };

export type AgentResult = { ok: true; result: unknown } | { ok: false; error: string; code?: DenialCode };
