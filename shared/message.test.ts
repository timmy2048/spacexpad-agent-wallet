import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import nacl from 'tweetnacl';
import { resolveCluster } from './chains.ts';
import {
  assertMessageChain,
  messageBytes,
  publicKeyBytes,
  signatureBase58,
  signatureBase64,
  signEd25519,
  verifyEd25519,
} from './message.ts';

const CHALLENGE = 'AgentPad Solana Gate Auth\nWallet: 11111111111111111111111111111111\nNonce: abc\nExpires: 1795287599741';

describe('message bytes', () => {
  it('signs a challenge as its exact UTF-8 bytes', () => {
    const bytes = messageBytes(CHALLENGE, 'utf8');
    assert.deepEqual([...bytes], [...new TextEncoder().encode(CHALLENGE)]);
    const pair = nacl.sign.keyPair();
    const signature = signEd25519(bytes, pair.secretKey);
    assert.equal(verifyEd25519(bytes, signature, pair.publicKey), true);
    assert.equal(verifyEd25519(new TextEncoder().encode(`${CHALLENGE}\n`), signature, pair.publicKey), false);
    const base64 = signatureBase64(signature);
    const restored = Uint8Array.from(Buffer.from(base64, 'base64'));
    assert.equal(verifyEd25519(bytes, restored, pair.publicKey), true);
    assert.equal(signatureBase58(signature).length > 0, true);
  });

  it('decodes hex and base64 without adding bytes', () => {
    const raw = new TextEncoder().encode('hi');
    const hex = [...raw].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    assert.deepEqual([...messageBytes(hex, 'hex')], [...raw]);
    assert.deepEqual([...messageBytes(`0x${hex}`, 'hex')], [...raw]);
    const base64 = Buffer.from(raw).toString('base64');
    assert.deepEqual([...messageBytes(base64, 'base64')], [...raw]);
    assert.throws(() => messageBytes('zz', 'hex'), /hex/);
    assert.throws(() => messageBytes('****', 'base64'), /base64/);
  });

  it('rejects a non-solana chain and a Solana testnet label', () => {
    assert.throws(() => assertMessageChain('ethereum'), /Solana only/);
    assert.throws(() => assertMessageChain('base'), /Solana only/);
    assert.throws(() => resolveCluster('solana', 'testnet'), /devnet/);
    assert.equal(resolveCluster('solana', undefined).network, 'mainnet');
    assert.equal(resolveCluster('solana', 'devnet').network, 'devnet');
  });

  it('round-trips a public key used for verification', () => {
    const pair = nacl.sign.keyPair();
    const address = signatureBase58(pair.publicKey);
    assert.deepEqual([...publicKeyBytes(address)], [...pair.publicKey]);
    const message = messageBytes('hello', 'utf8');
    const signature = signEd25519(message, pair.secretKey);
    assert.equal(verifyEd25519(message, signature, publicKeyBytes(address)), true);
  });
});
