import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { inspectSolanaTransaction } from './solanaTx.ts';

describe('solana transactions', () => {
  it('reads the recipient of a native transfer', () => {
    const from = Keypair.generate().publicKey;
    const to = new PublicKey('So11111111111111111111111111111111111111112');
    const tx = new Transaction({
      feePayer: from,
      recentBlockhash: new PublicKey(new Uint8Array(32).fill(7)).toBase58(),
    });
    tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: 42 }));
    const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const facts = inspectSolanaTransaction(bytes);
    assert.deepEqual(facts.destinations, [to.toBase58()]);
    assert.equal(facts.lamports, 42n);
  });
});
