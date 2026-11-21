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

export function buildPairPrompt(pairCode: string): string {
  return [
    'Connect to the SpaceXpad agent wallet through its local MCP server.',
    `SpaceXpad's site is ${SPACEXPAD_SITE}`,
    `Reserved setup document for this extension only: ${SPACEXPAD_WALLET_DOCS}`,
    'That URL is not published. It is separate from /skill and /skill.md. Do not use /, /skill, /skill.md, or /agents. Those belong to the launchpad.',
    'There is no hosted wallet endpoint. Do not invent a tool name or put this PAIR_CODE in a public URL.',
    '',
    `PAIR_CODE: ${pairCode}`,
    'This code expires 10 minutes after it was copied. The user can remove the binding in the extension.',
    '',
    'Setup, once, from a checkout of this repository (the folder with package.json and mcp/src/index.ts):',
    '  npm install',
    '  npm run build',
    '  node --experimental-strip-types mcp/src/index.ts',
    '',
    'That process is the MCP server. It speaks MCP on stdin/stdout.',
    'It also listens on http://127.0.0.1:47321 and accepts only loopback clients with the bridge token.',
    'The token is printed on stderr and written to ~/.spacexpad-agent-wallet/bridge.json.',
    'The user pastes it into SpaceXpad settings. Do not ask for it in chat and do not put it in the prompt.',
    '',
    'Cursor or Claude Desktop config:',
    '{',
    '  "mcpServers": {',
    '    "spacexpad-agent-wallet": {',
    '      "command": "node",',
    '      "args": ["--experimental-strip-types", "mcp/src/index.ts"],',
    '      "cwd": "<absolute path to this repository>"',
    '    }',
    '  }',
    '}',
    '',
    'Discover tools from that server. It registers only these tools:',
    '- spacexpad_pair',
    '- spacexpad_get_addresses',
    '- spacexpad_get_balance',
    '- spacexpad_sign_transaction',
    '- spacexpad_send_transaction',
    '',
    'Call spacexpad_pair with this PAIR_CODE and your agent name.',
    'Show the user the binding token that starts with spx_bind_ and wait until they paste it into the extension.',
    'Do not call the other tools until that bind succeeds.',
    '',
    'Network: omit network to use mainnet.',
    'Pass testnet or devnet only when the user explicitly asked for that cluster.',
    'A testnet or devnet signature or send waits for confirmation in the extension. Nothing is signed until they confirm.',
    'Do not switch to a test network on your own.',
    'chain: solana | ethereum | base | bnb',
    'Solana test traffic uses devnet, not testnet.',
    'Ethereum and Base testnet means Sepolia. BNB Chain testnet means BSC testnet.',
    '',
    'After binding you can read addresses, read balances, request a signature, or submit a transaction.',
    'The wallet enforces the user risk policy and the kill switch.',
    'If a tool returns an error, report that error. Do not claim a transaction succeeded unless the tool returned a hash.',
  ].join('\n');
}

export const BIND_TOKEN_PATTERN = /^spx_bind_[a-f0-9]{48}$/i;

export const MCP_TOOL_NAMES = [
  'spacexpad_pair',
  'spacexpad_get_addresses',
  'spacexpad_get_balance',
  'spacexpad_sign_transaction',
  'spacexpad_send_transaction',
] as const;
