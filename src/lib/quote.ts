import { resolveCluster } from '../../shared/chains.ts';
import { evmCallFromSerialized, evmDestinations } from '../../shared/evmIntent.ts';
import { parseDecimal, rawToMicroUsd } from '../../shared/money.ts';
import type { TxParams } from '../../shared/types.ts';
import { decodeSerialized, inspectSolanaTransaction } from './solanaTx.ts';
import { priceOf } from './balances.ts';

export type Quote = {
  transferMicroUsd: bigint | null;
  destinations: string[] | null;
};

export async function quoteTransaction(params: TxParams, rpcUrl: string): Promise<Quote> {
  const cluster = resolveCluster(params.chain, params.network);
  if (params.kind === 'native_transfer') {
    if (!params.to || !params.amount) throw new Error('Native transfer needs to and amount.');
    const raw = parseDecimal(params.amount, cluster.nativeDecimals);
    const price = await priceOf(cluster.priceId);
    return {
      destinations: [params.to],
      transferMicroUsd: price === null ? null : rawToMicroUsd(raw, cluster.nativeDecimals, price),
    };
  }
  if (!params.serialized) throw new Error('Serialized transaction is missing.');
  if (cluster.chain === 'solana') {
    const facts = inspectSolanaTransaction(decodeSerialized(params.serialized));
    const price = await priceOf(cluster.priceId);
    return {
      destinations: facts.destinations,
      transferMicroUsd:
        facts.lamports === null || price === null ? null : rawToMicroUsd(facts.lamports, 9, price),
    };
  }
  const call = evmCallFromSerialized(params.serialized);
  const destinations = evmDestinations(call);
  if (!call.recognized) return { destinations, transferMicroUsd: null };
  let micro = 0n;
  let priced = true;
  if (call.value > 0n) {
    const price = await priceOf(cluster.priceId);
    if (price === null) priced = false;
    else micro += rawToMicroUsd(call.value, cluster.nativeDecimals, price);
  }
  if (call.token) {
    const slug = cluster.chain === 'bnb' ? 'bsc' : cluster.chain;
    const decimals = await readErc20Decimals(rpcUrl, call.token.contract);
    const price = await priceOf(`${slug}:${call.token.contract.toLowerCase()}`);
    if (decimals === null || price === null) priced = false;
    else micro += rawToMicroUsd(call.token.raw, decimals, price);
  }
  if (call.value === 0n && !call.token) micro = 0n;
  return { destinations, transferMicroUsd: priced ? micro : null };
}

async function readErc20Decimals(rpcUrl: string, contract: string): Promise<number | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: contract, data: '0x313ce567' }, 'latest'],
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { result?: string };
    if (!json.result || json.result === '0x') return null;
    const decimals = Number(BigInt(json.result));
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
    return decimals;
  } catch {
    return null;
  }
}
