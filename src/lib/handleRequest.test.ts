import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultStore } from '../../shared/store.ts';
import type { Inbound, Snapshot, Store, TxParams } from '../../shared/types.ts';
import { handleAgentRequest, type HandlerDeps } from './handleRequest.ts';

const TOKEN = `spx_bind_${'ab'.repeat(24)}`;

function readyStore(patch: Partial<Store> = {}): Store {
  return {
    ...defaultStore(),
    ...patch,
    agents: patch.agents ?? [{ id: 'agent_1', name: 'Claude', token: TOKEN, boundAt: 1 }],
    addresses: patch.addresses ?? {
      solana: 'SoLanaAddress11111111111111111111111111111',
      evm: '0x1111111111111111111111111111111111111111',
    },
    settings: {
      ...defaultStore().settings,
      hydrated: true,
      rpc: {
        'solana:mainnet': 'https://rpc.example/sol',
        'solana:devnet': 'https://rpc.example/sol-dev',
        'ethereum:mainnet': 'https://rpc.example/eth',
        'ethereum:testnet': 'https://rpc.example/eth-test',
        'base:mainnet': 'https://rpc.example/base',
        'base:testnet': 'https://rpc.example/base-test',
        'bnb:mainnet': 'https://rpc.example/bnb',
        'bnb:testnet': 'https://rpc.example/bnb-test',
      },
    },
  };
}

function harness(initial: Store, extras: Partial<HandlerDeps> = {}) {
  let store = initial;
  const signed: TxParams[] = [];
  const reads: string[] = [];
  const deps: HandlerDeps = {
    load: async () => store,
    update: async (patch) => {
      store = patch(store);
      return store;
    },
    sign: async (params) => {
      signed.push(params);
      return { signedTransaction: 'signed-in-test' };
    },
    confirm: async () => true,
    quote: async () => ({ destinations: ['0xabc'], transferMicroUsd: 1n }),
    readBalance: async (input) => {
      reads.push(`${input.chain}:${input.network}`);
      const snapshot: Snapshot = {
        chain: input.chain,
        network: input.network === 'devnet' || input.network === 'testnet' ? input.network : 'mainnet',
        status: 'ready',
        error: null,
        tokenListError: null,
        assets: [],
        readAt: 1,
      };
      return snapshot;
    },
    now: () => Date.parse('2026-11-21T00:00:00Z'),
    ...extras,
  };
  return { deps, signed, reads, current: () => store };
}

describe('mainnet view versus explicit network actions', () => {
  it('reads mainnet when a balance request omits the cluster', async () => {
    const box = harness(readyStore());
    const inbound: Inbound = { id: 'b1', method: 'get_balance', params: { bindToken: TOKEN, chain: 'base' } };
    const result = await handleAgentRequest(box.deps, inbound);
    assert.equal(result.ok, true);
    assert.deepEqual(box.reads, ['base:mainnet']);
    if (result.ok) {
      const body = result.result as { network: string };
      assert.equal(body.network, 'mainnet');
    }
  });

  it('signs on mainnet without a testnet confirmation when the cluster is omitted', async () => {
    let asked = false;
    const box = harness(readyStore(), {
      approveNonMainnet: async () => {
        asked = true;
        return false;
      },
    });
    const inbound: Inbound = {
      id: 's1',
      method: 'sign',
      params: { bindToken: TOKEN, chain: 'ethereum', kind: 'native_transfer', to: '0xabc', amount: '0.01' },
    };
    const result = await handleAgentRequest(box.deps, inbound);
    assert.equal(asked, false);
    assert.equal(result.ok, true);
    assert.equal(box.signed[0]?.network, 'mainnet');
    assert.equal(box.signed.length, 1);
  });

  it('does not sign an explicit devnet request unless the user confirms', async () => {
    const box = harness(readyStore(), { approveNonMainnet: async () => false });
    const inbound: Inbound = {
      id: 's2',
      method: 'sign',
      params: { bindToken: TOKEN, chain: 'solana', network: 'devnet', kind: 'native_transfer', to: 'dest', amount: '0.01' },
    };
    const result = await handleAgentRequest(box.deps, inbound);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /not confirmed/);
    assert.equal(box.signed.length, 0);
    assert.equal(box.current().activity[0]?.network, 'devnet');
  });

  it('signs an explicit devnet request only after confirmation and does not rewrite it to mainnet', async () => {
    const box = harness(readyStore(), { approveNonMainnet: async () => true });
    const inbound: Inbound = {
      id: 's3',
      method: 'sign',
      params: { bindToken: TOKEN, chain: 'solana', network: 'devnet', kind: 'native_transfer', to: 'dest', amount: '0.01' },
    };
    const result = await handleAgentRequest(box.deps, inbound);
    assert.equal(result.ok, true);
    assert.equal(box.signed[0]?.network, 'devnet');
    if (result.ok) {
      const body = result.result as { network: string; hash: string | null };
      assert.equal(body.network, 'devnet');
      assert.equal(body.hash, null);
    }
  });

  it('rejects a Solana testnet label instead of treating it as devnet', async () => {
    const box = harness(readyStore());
    const inbound: Inbound = {
      id: 'b2',
      method: 'get_balance',
      params: { bindToken: TOKEN, chain: 'solana', network: 'testnet' },
    };
    const result = await handleAgentRequest(box.deps, inbound);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /devnet/);
    assert.deepEqual(box.reads, []);
  });

  it('still blocks mainnet signing when agents are paused', async () => {
    const box = harness(readyStore({ policy: { ...defaultStore().policy, agentsPaused: true } }));
    const inbound: Inbound = {
      id: 's4',
      method: 'send',
      params: { bindToken: TOKEN, chain: 'base', kind: 'native_transfer', to: '0xabc', amount: '1' },
    };
    const result = await handleAgentRequest(box.deps, inbound);
    assert.equal(result.ok, false);
    assert.equal(box.signed.length, 0);
    assert.equal(box.current().activity[0]?.network, 'mainnet');
    assert.equal(box.current().activity[0]?.status, 'blocked');
  });
});
