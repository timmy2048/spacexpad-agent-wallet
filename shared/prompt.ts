export function createPairCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

export function buildPairPrompt(pairCode: string): string {
  return [
    'Connect to the SpaceXpad agent wallet.',
    '',
    `PAIR_CODE: ${pairCode}`,
    '',
    'Call the MCP tool spacexpad_pair with this pair code and your agent name.',
    'Then show the user the binding token that starts with spx_bind_ so they can paste it into the extension.',
    '',
    'Permissions:',
    '- Read balances and list tokens',
    '- Request a signature',
    '- Sign and submit a transaction',
    '',
    'There is no default chain and no default network.',
    'Every balance, sign, and send call must include both chain and network.',
    'chain: solana | ethereum | base | bnb',
    'network: mainnet | testnet | devnet',
    'For Solana, pass devnet (not testnet) or mainnet.',
    'For Ethereum and Base, testnet means Sepolia.',
    'For BNB Chain, testnet means BSC testnet.',
    'If the user did not name the chain and the cluster, ask. Do not guess.',
    '',
    'The wallet enforces the user risk policy and the kill switch.',
    'If a tool returns an error, report that error. Do not claim a transaction succeeded unless the tool returned a hash.',
  ].join('\n');
}

export const BIND_TOKEN_PATTERN = /^spx_bind_[a-f0-9]{48}$/i;
