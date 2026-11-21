const EMBEDDED_CLIENTS = new Set(['privy', 'privy-v2']);

export type AccountLike = {
  type?: string;
  chainType?: string;
  walletClientType?: string;
};

export type EmbeddedPresence = {
  ethereum: boolean;
  solana: boolean;
};

export function embeddedPresence(accounts: AccountLike[]): EmbeddedPresence {
  const presence: EmbeddedPresence = { ethereum: false, solana: false };
  for (const account of accounts) {
    if (account.type !== 'wallet') continue;
    if (!account.walletClientType || !EMBEDDED_CLIENTS.has(account.walletClientType)) continue;
    if (account.chainType === 'ethereum') presence.ethereum = true;
    if (account.chainType === 'solana') presence.solana = true;
  }
  return presence;
}

export function missingEmbeddedWallets(presence: EmbeddedPresence): Array<'ethereum' | 'solana'> {
  const missing: Array<'ethereum' | 'solana'> = [];
  if (!presence.ethereum) missing.push('ethereum');
  if (!presence.solana) missing.push('solana');
  return missing;
}
