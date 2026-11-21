import nacl from 'tweetnacl';
export type MessageEncoding = 'utf8' | 'hex' | 'base64';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function messageBytes(message: string, encoding: MessageEncoding = 'utf8'): Uint8Array {
  if (encoding === 'utf8') return new TextEncoder().encode(message);
  if (encoding === 'hex') return decodeHex(message);
  return decodeBase64(message);
}

export function messagePreview(bytes: Uint8Array, message: string, encoding: MessageEncoding): string {
  if (encoding === 'utf8') return message;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return message;
  }
}

export function assertMessageChain(chain: string): asserts chain is 'solana' {
  if (chain !== 'solana') {
    throw new Error('Message signing currently supports Solana only. Pass chain "solana".');
  }
}

export function signatureBase64(signature: Uint8Array): string {
  let text = '';
  for (const byte of signature) text += String.fromCharCode(byte);
  return btoa(text);
}

export function signatureBase58(signature: Uint8Array): string {
  return base58Encode(signature);
}

export function publicKeyBytes(address: string): Uint8Array {
  const raw = base58Decode(address);
  if (raw.length !== 32) throw new Error('Invalid Solana public key.');
  return raw;
}

export function verifyEd25519(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  if (signature.length !== 64 || publicKey.length !== 32) return false;
  return nacl.sign.detached.verify(message, signature, publicKey);
}

export function signEd25519(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, secretKey);
}

function decodeHex(message: string): Uint8Array {
  const hex = message.startsWith('0x') || message.startsWith('0X') ? message.slice(2) : message;
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('Message is not valid hex.');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

function decodeBase64(message: string): Uint8Array {
  if (message.length === 0 || message.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(message)) {
    throw new Error('Message is not valid base64.');
  }
  const binary = atob(message);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  if (btoa(binary).replace(/=+$/, '') !== message.replace(/=+$/, '')) {
    throw new Error('Message is not valid base64.');
  }
  return out;
}

function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  let num = 0n;
  for (const byte of bytes) num = (num << 8n) + BigInt(byte);
  let out = '';
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  return '1'.repeat(zeros) + out;
}

function base58Decode(value: string): Uint8Array {
  let num = 0n;
  for (const char of value) {
    const index = B58.indexOf(char);
    if (index < 0) throw new Error('Invalid Solana public key.');
    num = num * 58n + BigInt(index);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  let zeros = 0;
  while (zeros < value.length && value[zeros] === '1') zeros += 1;
  const out = new Uint8Array(zeros + bytes.length);
  out.set(bytes, zeros);
  return out;
}

