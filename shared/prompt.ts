export function createPairCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

export const SPACEXPAD_SITE = 'https://spacexpad.xyz/';
export const SPACEXPAD_WALLET_DOCS = 'https://spacexpad.xyz/agent-wallet/skill.md';

export function buildInstallNote(pairCode: string | null, registered = false): string {
  const lines = [
    `Read ${SPACEXPAD_WALLET_DOCS} and set up this SpaceXpad agent wallet.`,
    'That page is the wallet skill. Do not use the launchpad skill pages.',
    '',
    'Start the local MCP server from a checkout of this repository:',
    '  npm install',
    '  npm run build',
    '  node --experimental-strip-types mcp/src/index.ts',
    'It listens on http://127.0.0.1:47321. The extension connects on its own.',
    'Do not ask the user to paste a bridge token into Settings.',
  ];
  if (pairCode) {
    lines.push(
      '',
      `PAIR_CODE: ${pairCode}`,
      'This code expires 10 minutes after it was copied. Keep it in this message. Do not put it in a public URL.',
      'Call spacexpad_pair with this PAIR_CODE and your agent name.',
      'Show the spx_bind_ token and wait until it is bound in the extension.',
    );
    if (!registered) {
      lines.push('If spacexpad_pair rejects this code, ask the user to copy the install note again after the local server is running.');
    }
  } else {
    lines.push('', 'After the server is running, ask the user to copy the install note again. That copy includes PAIR_CODE.');
  }
  lines.push(
    '',
    'Omit network to use mainnet. Pass testnet or devnet only when the user explicitly asked.',
    'Solana test traffic is devnet, not testnet. Ethereum and Base testnet means Sepolia. BNB Chain testnet means BSC testnet.',
  );
  return lines.join('\n');
}

export function buildPairPrompt(pairCode: string): string {
  return buildInstallNote(pairCode, true);
}

export const BIND_TOKEN_PATTERN = /^spx_bind_[a-f0-9]{48}$/i;

export const MCP_TOOL_NAMES = [
  'spacexpad_pair',
  'spacexpad_get_addresses',
  'spacexpad_get_balance',
  'spacexpad_sign_transaction',
  'spacexpad_send_transaction',
] as const;
