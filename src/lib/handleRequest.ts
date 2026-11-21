import { resolveCluster } from '../../shared/chains.ts';
import { policyText } from '../../shared/i18n.ts';
import { utcDate } from '../../shared/money.ts';
import { evaluatePolicy } from '../../shared/policy.ts';
import type { Activity, AgentResult, Inbound, Snapshot, Store, TxParams } from '../../shared/types.ts';
import { readClusterBalance } from './balances.ts';
import { quoteTransaction } from './quote.ts';

export type SignOutcome = { hash?: string; signedTransaction?: string };

export type HandlerDeps = {
  load: () => Promise<Store>;
  update: (patch: (store: Store) => Store) => Promise<Store>;
  sign: (params: TxParams, rpcUrl: string, method: 'sign' | 'send') => Promise<SignOutcome>;
  confirm: (id: string) => Promise<boolean>;
  now: () => number;
};

export async function handleAgentRequest(deps: HandlerDeps, inbound: Inbound): Promise<AgentResult> {
  try {
    const store = await deps.load();
    const agent = store.agents.find((item) => item.token === inbound.params.bindToken);
    if (!agent) {
      return { ok: false, error: 'This binding token is not recognized. Paste it into SpaceXpad first.' };
    }
    if (inbound.method === 'get_addresses') return addresses(store);
    const cluster = resolveCluster(inbound.params.chain, inbound.params.network);
    const rpcUrl = store.settings.rpc[cluster.rpcKey];
    if (!rpcUrl) return { ok: false, error: `No RPC is configured for ${cluster.rpcKey}.` };

    if (inbound.method === 'get_balance') {
      const snapshot = await readClusterBalance({
        chain: inbound.params.chain,
        network: inbound.params.network,
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

    const quote = await quoteTransaction(inbound.params, rpcUrl);
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
      outcome = await deps.sign(inbound.params, rpcUrl, inbound.method);
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

    void refreshQuietly(deps, inbound.params, rpcUrl);

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
  const snapshot = await readClusterBalance({
    chain: params.chain,
    network: params.network,
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
