import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

const SYSTEM = SystemProgram.programId.toBase58();
const COMPUTE = 'ComputeBudget111111111111111111111111111111';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export type SolanaFacts = {
  destinations: string[] | null;
  lamports: bigint | null;
};

export async function buildSolTransfer(
  rpcUrl: string,
  from: string,
  to: string,
  lamports: bigint,
): Promise<Uint8Array> {
  if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large to encode.');
  const connection = new Connection(rpcUrl, 'confirmed');
  const fromKey = new PublicKey(from);
  const toKey = new PublicKey(to);
  const latest = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: fromKey, recentBlockhash: latest.blockhash });
  tx.add(
    SystemProgram.transfer({
      fromPubkey: fromKey,
      toPubkey: toKey,
      lamports: Number(lamports),
    }),
  );
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
}

export async function sendSignedSol(rpcUrl: string, signed: Uint8Array): Promise<string> {
  const connection = new Connection(rpcUrl, 'confirmed');
  return connection.sendRawTransaction(signed, { skipPreflight: false });
}

export function inspectSolanaTransaction(bytes: Uint8Array): SolanaFacts {
  try {
    return inspectVersioned(VersionedTransaction.deserialize(bytes));
  } catch {
    return inspectLegacy(Transaction.from(bytes));
  }
}

function inspectLegacy(tx: Transaction): SolanaFacts {
  const destinations: string[] = [];
  let lamports = 0n;
  let priced = true;
  for (const ix of tx.instructions) {
    const program = ix.programId.toBase58();
    if (program === COMPUTE) continue;
    if (program === SYSTEM) {
      if (ix.data[0] === 2 && ix.keys[1]) {
        destinations.push(ix.keys[1].pubkey.toBase58());
        lamports += readU64(ix.data.subarray(4, 12));
      }
      continue;
    }
    priced = false;
    pushProgramDestination(destinations, program, ix.keys.map((key) => key.pubkey.toBase58()), ix.data[0]);
  }
  return { destinations, lamports: priced ? lamports : null };
}

function inspectVersioned(tx: VersionedTransaction): SolanaFacts {
  if (tx.message.addressTableLookups.length > 0) return { destinations: null, lamports: null };
  const keys = tx.message.staticAccountKeys;
  const destinations: string[] = [];
  let lamports = 0n;
  let priced = true;
  for (const ix of tx.message.compiledInstructions) {
    const program = keys[ix.programIdIndex]?.toBase58();
    if (!program) return { destinations: null, lamports: null };
    const accounts = ix.accountKeyIndexes.map((index) => keys[index]?.toBase58() ?? '');
    if (program === COMPUTE) continue;
    if (program === SYSTEM) {
      if (ix.data[0] === 2 && accounts[1]) {
        destinations.push(accounts[1]);
        lamports += readU64(ix.data.subarray(4, 12));
      }
      continue;
    }
    priced = false;
    pushProgramDestination(destinations, program, accounts, ix.data[0]);
  }
  return { destinations, lamports: priced ? lamports : null };
}

function pushProgramDestination(destinations: string[], program: string, accounts: string[], tag: number | undefined): void {
  if ((program === TOKEN || program === TOKEN_2022) && tag === 12 && accounts[1]) {
    destinations.push(accounts[1]);
    return;
  }
  if ((program === TOKEN || program === TOKEN_2022) && accounts[1]) {
    destinations.push(accounts[1]);
    return;
  }
  destinations.push(program);
}

function readU64(data: Uint8Array): bigint {
  let value = 0n;
  for (let index = 0; index < data.length; index += 1) {
    value += BigInt(data[index] ?? 0) << BigInt(8 * index);
  }
  return value;
}

export function decodeSerialized(serialized: string): Uint8Array {
  const trimmed = serialized.trim();
  if (trimmed.startsWith('0x')) {
    const hex = trimmed.slice(2);
    const out = new Uint8Array(hex.length / 2);
    for (let index = 0; index < out.length; index += 1) out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    return out;
  }
  const binary = atob(trimmed);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
