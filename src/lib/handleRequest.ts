import { browserRpcUrl, resolveCluster } from '../../shared/chains.ts';
import { policyText } from '../../shared/i18n.ts';
import {
  assertMessageChain,
  messageBytes,
  messagePreview,
  publicKeyBytes,
  signatureBase58,
  signatureBase64,
  verifyEd25519,
} from '../../shared/message.ts';
import { utcDate } from '../../shared/money.ts';
import { evaluatePolicy } from '../../shared/policy.ts';
import type { Activity, AgentResult, Inbound, NetworkId, PendingApproval, Snapshot, Store, TxParams } from '../../shared/types.ts';
import { readClusterBalance } from './balances.ts';
import { quoteTransaction, type Quote } from './quote.ts';

export type SignOutcome = { hash?: string; signedTransaction?: string };

export type HandlerDeps = {
  load: () => Promise<Store>;
  update: (patch: (store: Store) => Store) => Promise<Store>;
  sign: (params: TxParams, rpcUrl: string, method: 'sign' | 'send') => Promise<SignOutcome>;
  signMessage?: (input: { message: Uint8Array }) => Promise<{ signature: Uint8Array; publicKey: string }>;
  confirm: (id: string) => Promise<boolean>;
  approveNonMainnet?: (pending: PendingApproval) => Promise<boolean>;
  readBalance?: typeof readClusterBalance;
  quote?: (params: TxParams, rpcUrl: string) => Promise<Quote>;
  now: () => number;
};

export async function handleAgentRequest(deps: HandlerDeps, inbound: Inbound): Promise<AgentResult> {
  try {
    const store = await deps.load();
    const agent = store.agents.find((item) => item.token === inbound.params.bindToken);
    if (!agent) {
      return { ok: false, error: 'This binding token is not recognized. Paste it into the SpaceXpad bind screen first.' };
    }
    if (inbound.method === 'get_addresses') return addresses(store);
    if (inbound.method === 'sign_message') return await signMessageRequest(deps, inbound, store, agent.name);
    const cluster = resolveCluster(inbound.params.chain, inbound.params.network);
    const rpcUrl = browserRpcUrl(cluster.chain, cluster.network, store.settings.rpc[cluster.rpcKey] ?? '');
    if (!rpcUrl) return { ok: false, error: `No RPC is configured for ${cluster.rpcKey}.` };

    if (inbound.method === 'get_balance') {
      const snapshot = await (deps.readBalance ?? readClusterBalance)({
        chain: cluster.chain,
        network: cluster.network,
        solanaAddress: store.addresses?.solana ?? null,
        evmAddress: store.addresses?.evm ?? null,
        rpcUrl,
        now: deps.now(),
      });
      const detail =
        snapshot.status === 'error'
          ? snapshot.error || 'Balance could not be loaded.'
          : snapshot.tokenListError
            ? `Balance read. ${snapshot.tokenListError}`
            : 'Balance read.';
      await deps.update((current) =>
        withActivity(upsertSnapshot(current, snapshot), {
          at: deps.now(),
          agentName: agent.name,
          method: 'balance',
          chain: cluster.chain,
          network: cluster.network,
          status: snapshot.status === 'error' ? 'error' : 'ok',
          detail,
        }),
      );
      if (snapshot.status === 'error') return { ok: false, error: detail };
      const address = cluster.addressKind === 'solana' ? store.addresses?.solana : store.addresses?.evm;
      return {
        ok: true,
        result: {
          chain: cluster.chain,
          network: cluster.network,
          cluster: cluster.clusterName,
          address,
          assets: snapshot.assets,
          tokenListError: snapshot.tokenListError,
        },
      };
    }

    if (store.policy.agentsPaused) {
      const detail = policyText('en', { code: 'paused' });
      await deps.update((current) =>
        withActivity(current, {
          at: deps.now(),
          agentName: agent.name,
          method: inbound.method,
          chain: cluster.chain,
          network: cluster.network,
          status: 'blocked',
          detail,
        }),
      );
      return { ok: false, error: detail, code: 'paused' };
    }

    if (cluster.network !== 'mainnet') {
      const pending: PendingApproval = {
        id: inbound.id,
        method: inbound.method,
        chain: cluster.chain,
        network: cluster.network,
        agentName: agent.name,
        expiresAt: deps.now() + 60_000,
      };
      const allowed = deps.approveNonMainnet ? await deps.approveNonMainnet(pending) : false;
      if (!allowed) {
        const detail = 'This test network was not confirmed. Nothing was signed.';
        await deps.update((current) =>
          withActivity(current, {
            at: deps.now(),
            agentName: agent.name,
            method: inbound.method,
            chain: cluster.chain,
            network: cluster.network,
            status: 'blocked',
            detail,
          }),
        );
        return { ok: false, error: detail };
      }
    }

    const params: TxParams = {
      bindToken: inbound.params.bindToken,
      chain: cluster.chain,
      network: cluster.network,
      kind: inbound.params.kind,
      to: inbound.params.to,
      amount: inbound.params.amount,
      serialized: inbound.params.serialized,
    };
    const quote = await (deps.quote ?? quoteTransaction)(params, rpcUrl);
    const decision = evaluatePolicy({
      policy: store.policy,
      spent: store.spend,
      now: deps.now(),
      transferMicroUsd: quote.transferMicroUsd,
      destinations: quote.destinations,
    });
    if (!decision.allow) {
      const detail = policyText('en', decision);
      await deps.update((current) =>
        withActivity(current, {
          at: deps.now(),
          agentName: agent.name,
          method: inbound.method,
          chain: cluster.chain,
          network: cluster.network,
          status: 'blocked',
          detail,
        }),
      );
      return { ok: false, error: detail, code: decision.code };
    }

    const proceed = await deps.confirm(inbound.id);
    if (!proceed) return { ok: false, error: 'The agent stopped waiting before this was signed. Nothing was signed.' };

    let outcome: SignOutcome;
    try {
      outcome = await deps.sign(params, rpcUrl, inbound.method);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Signing failed.';
      await deps.update((current) =>
        withActivity(current, {
          at: deps.now(),
          agentName: agent.name,
          method: inbound.method,
          chain: cluster.chain,
          network: cluster.network,
          status: 'error',
          detail,
        }),
      );
      return { ok: false, error: detail };
    }

    if (inbound.method === 'send' && !outcome.hash) {
      const detail = 'The transaction was not submitted. No hash was returned.';
      await deps.update((current) =>
        withActivity(current, {
          at: deps.now(),
          agentName: agent.name,
          method: 'send',
          chain: cluster.chain,
          network: cluster.network,
          status: 'error',
          detail,
        }),
      );
      return { ok: false, error: detail };
    }

    await deps.update((current) => {
      let next = current;
      if (inbound.method === 'send' && quote.transferMicroUsd !== null) {
        const date = utcDate(deps.now());
        const previous = current.spend.date === date ? BigInt(current.spend.microUsd || '0') : 0n;
        next = { ...current, spend: { date, microUsd: (previous + quote.transferMicroUsd).toString() } };
      }
      return withActivity(next, {
        at: deps.now(),
        agentName: agent.name,
        method: inbound.method,
        chain: cluster.chain,
        network: cluster.network,
        status: 'ok',
        detail: inbound.method === 'send' ? 'Submitted' : 'Signed, not submitted',
        hash: outcome.hash,
      });
    });

    void refreshQuietly(deps, params, rpcUrl);

    return {
      ok: true,
      result: {
        chain: cluster.chain,
        network: cluster.network,
        cluster: cluster.clusterName,
        status: inbound.method === 'send' ? 'submitted' : 'signed',
        hash: outcome.hash ?? null,
        signedTransaction: outcome.signedTransaction ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Request failed.' };
  }
}

async function signMessageRequest(
  deps: HandlerDeps,
  inbound: Extract<Inbound, { method: 'sign_message' }>,
  store: Store,
  agentName: string,
): Promise<AgentResult> {
  assertMessageChain(inbound.params.chain);
  const cluster = resolveCluster('solana', inbound.params.network);
  const encoding = inbound.params.encoding ?? 'utf8';
  const bytes = messageBytes(inbound.params.message, encoding);
  const preview = messagePreview(bytes, inbound.params.message, encoding);
  if (store.policy.agentsPaused) {
    const detail = policyText('en', { code: 'paused' });
    await recordMessage(deps, agentName, cluster.network, 'blocked', detail);
    return { ok: false, error: detail, code: 'paused' };
  }
  const address = store.addresses?.solana;
  if (!address) return { ok: false, error: 'Wallets are not ready yet.' };
  const pending: PendingApproval = {
    id: inbound.id,
    method: 'sign_message',
    chain: cluster.chain,
    network: cluster.network,
    agentName,
    expiresAt: deps.now() + 60_000,
    message: preview,
  };
  const allowed = deps.approveNonMainnet ? await deps.approveNonMainnet(pending) : false;
  if (!allowed) {
    const detail = 'This message was not confirmed. Nothing was signed.';
    await recordMessage(deps, agentName, cluster.network, 'blocked', detail);
    return { ok: false, error: detail };
  }
  if (!deps.signMessage) return { ok: false, error: 'Message signing is not available.' };
  let signed: { signature: Uint8Array; publicKey: string };
  try {
    signed = await deps.signMessage({ message: bytes });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Signing failed.';
    await recordMessage(deps, agentName, cluster.network, 'error', detail);
    return { ok: false, error: detail };
  }
  const key = publicKeyBytes(signed.publicKey);
  if (!verifyEd25519(bytes, signed.signature, key)) {
    const detail = 'The signature does not verify over the original message bytes.';
    await recordMessage(deps, agentName, cluster.network, 'error', detail);
    return { ok: false, error: detail };
  }
  await recordMessage(deps, agentName, cluster.network, 'ok', 'Message signed');
  return {
    ok: true,
    result: {
      chain: 'solana',
      network: cluster.network,
      publicKey: signed.publicKey,
      signature: signatureBase64(signed.signature),
      signatureEncoding: 'base64',
      signatureBase58: signatureBase58(signed.signature),
      messageEncoding: encoding,
    },
  };
}

async function recordMessage(
  deps: HandlerDeps,
  agentName: string,
  network: NetworkId,
  status: 'ok' | 'blocked' | 'error',
  detail: string,
): Promise<void> {
  await deps.update((current) =>
    withActivity(current, {
      at: deps.now(),
      agentName,
      method: 'sign_message',
      chain: 'solana',
      network,
      status,
      detail,
    }),
  );
}

function addresses(store: Store): AgentResult {
  if (!store.addresses?.solana || !store.addresses.evm) {
    return { ok: false, error: 'Wallets are not ready yet.' };
  }
  return {
    ok: true,
    result: {
      solana: store.addresses.solana,
      evm: store.addresses.evm,
      chains: {
        solana: store.addresses.solana,
        ethereum: store.addresses.evm,
        base: store.addresses.evm,
        bnb: store.addresses.evm,
      },
    },
  };
}

async function refreshQuietly(deps: HandlerDeps, params: TxParams, rpcUrl: string): Promise<void> {
  try {
    await refreshAfter(deps, params, rpcUrl);
  } catch {
    // The signature result is already stored. A failed reread is not a failed send.
  }
}

async function refreshAfter(deps: HandlerDeps, params: TxParams, rpcUrl: string): Promise<void> {
  const store = await deps.load();
  const network = params.network ?? 'mainnet';
  const snapshot = await (deps.readBalance ?? readClusterBalance)({
    chain: params.chain,
    network,
    solanaAddress: store.addresses?.solana ?? null,
    evmAddress: store.addresses?.evm ?? null,
    rpcUrl,
    now: deps.now(),
  });
  await deps.update((current) => upsertSnapshot(current, snapshot));
}

function upsertSnapshot(store: Store, snapshot: Snapshot): Store {
  return {
    ...store,
    snapshots: [
      ...store.snapshots.filter((item) => item.chain !== snapshot.chain || item.network !== snapshot.network),
      snapshot,
    ],
  };
}

function withActivity(store: Store, entry: Omit<Activity, 'id'>): Store {
  const activity: Activity = { ...entry, id: `${entry.at}-${store.activity.length}` };
  return { ...store, activity: [activity, ...store.activity].slice(0, 40) };
}
