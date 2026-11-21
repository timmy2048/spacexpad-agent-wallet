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

const INSTALL_SENTENCE = `Read ${SPACEXPAD_WALLET_DOCS} and set up this SpaceXpad agent wallet.`;

export function buildInstallNote(pairCode: string | null): string {
  if (!pairCode) return INSTALL_SENTENCE;
  return [INSTALL_SENTENCE, '', `PAIR_CODE: ${pairCode}`, 'This code expires in 10 minutes. Do not put it in a public URL.'].join('\n');
}

export function buildPairPrompt(pairCode: string): string {
  return buildInstallNote(pairCode);
}

export const BIND_TOKEN_PATTERN = /^spx_bind_[a-f0-9]{48}$/i;

export const MCP_TOOL_NAMES = [
  'spacexpad_pair',
  'spacexpad_get_addresses',
  'spacexpad_get_balance',
  'spacexpad_sign_transaction',
  'spacexpad_send_transaction',
] as const;
