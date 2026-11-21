import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serializeTransaction, type Hex } from 'viem';
import { buildAssetGroups, nativeAsset, parseBlockscoutTokens, parseSolanaTokenAccounts } from './assets.ts';
import { resolveCluster } from './chains.ts';
import { evmCallFromSerialized, evmDestinations } from './evmIntent.ts';
import { copyKeys, t } from './i18n.ts';
import { evaluatePolicy } from './policy.ts';
import { buildPairPrompt, MCP_TOOL_NAMES } from './prompt.ts';
import { isDisplayName } from './store.ts';
import { DEFAULT_POLICY } from './types.ts';
import { CHAIN_ORDER } from './types.ts';
import { embeddedPresence, missingEmbeddedWallets } from './wallets.ts';

describe('networks', () => {
  it('uses mainnet when the cluster is omitted and keeps an explicit test network', () => {
    assert.equal(resolveCluster('solana', '').network, 'mainnet');
    assert.equal(resolveCluster('ethereum', undefined).network, 'mainnet');
    assert.equal(resolveCluster('base', null).rpcKey, 'base:mainnet');
    assert.equal(resolveCluster('solana', 'devnet').clusterName, 'Devnet');
    assert.equal(resolveCluster('ethereum', 'testnet').clusterName, 'Sepolia');
    assert.equal(resolveCluster('bnb', 'mainnet').chainId, 56);
    assert.throws(() => resolveCluster('solana', 'testnet'), /devnet/);
    assert.throws(() => resolveCluster('base', 'devnet'), /testnet/);
    assert.throws(() => resolveCluster('ethereum', 'sepolia'), /mainnet/);
  });

  it('lists only the four supported chains', () => {
    assert.deepEqual([...CHAIN_ORDER], ['solana', 'ethereum', 'base', 'bnb']);
  });
});

describe('assets', () => {
  it('does not invent a zero before mainnet is read', () => {
    const groups = buildAssetGroups([]);
    assert.deepEqual(
      groups.map((group) => group.chain),
      ['solana', 'ethereum', 'base', 'bnb'],
    );
    for (const group of groups) {
      assert.equal(group.clusters[0]?.network, 'mainnet');
      assert.equal(group.clusters[0]?.status, 'absent');
      assert.equal(group.clusters[0]?.assets.length, 0);
    }
  });

  it('keeps a real zero and lists other tokens under the chain', () => {
    const groups = buildAssetGroups([
      {
        chain: 'base',
        network: 'testnet',
        status: 'ready',
        error: null,
        tokenListError: null,
        readAt: 1,
        assets: [
          nativeAsset('base', 0n),
          {
            symbol: 'USDC',
            name: 'USD Coin',
            amount: '1.5',
            raw: '1500000',
            decimals: 6,
            contract: '0xabc',
            native: false,
            usd: null,
          },
        ],
      },
    ]);
    const base = groups.find((group) => group.chain === 'base');
    assert.equal(base?.clusters[0]?.network, 'mainnet');
    assert.equal(base?.clusters[0]?.status, 'absent');
    assert.equal(base?.clusters[1]?.network, 'testnet');
    assert.equal(base?.clusters[1]?.assets[0]?.amount, '0');
    assert.equal(base?.clusters[1]?.assets[1]?.symbol, 'USDC');
    assert.equal(groups.find((group) => group.chain === 'solana')?.clusters[0]?.status, 'absent');
  });

  it('parses token lists and skips empty balances', () => {
    const sol = parseSolanaTokenAccounts({
      result: {
        value: [
          { account: { data: { parsed: { info: { mint: 'Mint111111111111111111111111111111111111', tokenAmount: { amount: '0', decimals: 6 } } } } } },
          { account: { data: { parsed: { info: { mint: 'Mint222222222222222222222222222222222222', tokenAmount: { amount: '5', decimals: 6, uiAmountString: '0.000005' } } } } } },
        ],
      },
    });
    assert.equal(sol.length, 1);
    assert.equal(sol[0]?.amount, '0.000005');
    const evm = parseBlockscoutTokens([
      { value: '0', token: { address: '0x1', symbol: 'ZERO', decimals: '6', type: 'ERC-20' } },
      { value: '10', token: { address: '0x2', symbol: 'USDC', decimals: '6', type: 'ERC-20' } },
      { value: '1', token: { address: '0x3', symbol: 'NFT', decimals: '0', type: 'ERC-721' } },
    ]);
    assert.deepEqual(evm.map((asset) => asset.symbol), ['USDC']);
  });
});

describe('policy', () => {
  const base = {
    policy: { ...DEFAULT_POLICY, whitelist: [] },
    spent: { date: '2026-11-21', microUsd: '0' },
    now: Date.parse('2026-11-21T00:00:00Z'),
    transferMicroUsd: 1_000_000n,
    destinations: ['0xabc'],
  };

  it('allows full access and still honors the kill switch and whitelist', () => {
    assert.equal(evaluatePolicy(base).allow, true);
    assert.equal(evaluatePolicy({ ...base, policy: { ...base.policy, agentsPaused: true } }).allow, false);
    const listed = evaluatePolicy({
      ...base,
      policy: { ...base.policy, whitelistEnabled: true, whitelist: [] },
    });
    assert.equal(listed.allow, false);
    if (!listed.allow) assert.equal(listed.code, 'whitelist-empty');
  });

  it('blocks priced transfers over the single and daily limits', () => {
    const limited = { ...base.policy, fullAccess: false, singleTxUsd: 0.5, dailyUsd: 2 };
    const single = evaluatePolicy({ ...base, policy: limited, transferMicroUsd: 2_000_000n });
    assert.equal(single.allow, false);
    if (!single.allow) assert.equal(single.code, 'single-limit');
    const daily = evaluatePolicy({
      ...base,
      policy: limited,
      transferMicroUsd: 400_000n,
      spent: { date: '2026-11-21', microUsd: '1800000' },
    });
    assert.equal(daily.allow, false);
    if (!daily.allow) assert.equal(daily.code, 'daily-limit');
  });

  it('does not invent a price when a limit needs one', () => {
    const decision = evaluatePolicy({
      ...base,
      policy: { ...base.policy, fullAccess: false, singleTxUsd: 10, dailyUsd: null },
      transferMicroUsd: null,
    });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.code, 'unpriced');
  });
});

describe('embedded wallets', () => {
  it('creates both chains after whitelabel login when the modal did not', () => {
    const presence = embeddedPresence([
      { type: 'email' },
      { type: 'wallet', chainType: 'ethereum', walletClientType: 'metamask' },
    ]);
    assert.deepEqual(missingEmbeddedWallets(presence), ['ethereum', 'solana']);
    const ready = embeddedPresence([
      { type: 'wallet', chainType: 'ethereum', walletClientType: 'privy' },
      { type: 'wallet', chainType: 'solana', walletClientType: 'privy-v2' },
    ]);
    assert.deepEqual(missingEmbeddedWallets(ready), []);
  });
});

describe('prompt and copy', () => {
  it('tells the agent how to run the local MCP server and that mainnet is the default', () => {
    const prompt = buildPairPrompt('ABCD2345');
    assert.match(prompt, /PAIR_CODE: ABCD2345/);
    assert.match(prompt, /node --experimental-strip-types mcp\/src\/index.ts/);
    assert.match(prompt, /127\.0\.0\.1:47321/);
    assert.match(prompt, /omit network to use mainnet/i);
    assert.match(prompt, /https:\/\/spacexpad\.xyz\/agent-wallet\/skill\.md/);
    assert.doesNotMatch(prompt, /https:\/\/spacexpad\.xyz\/skill(?:\.md)?/);
    assert.match(prompt, /not published/);
    assert.match(prompt, /no hosted wallet endpoint/i);
    assert.doesNotMatch(prompt, /https?:\/\/(?!(127\.0\.0\.1|spacexpad\.xyz))/);
    for (const name of MCP_TOOL_NAMES) assert.match(prompt, new RegExp(name));
    assert.equal(prompt.includes('尚未读取'), false);
  });

  it('keeps translations aligned and drops the unread placeholder', () => {
    assert.ok(copyKeys().length > 20);
    for (const key of copyKeys()) {
      for (const lang of ['en', 'zh-CN', 'zh-TW'] as const) {
        const line = t(lang, key);
        assert.equal(line.includes('尚未读取'), false);
        assert.equal(line.includes('尚未讀取'), false);
        assert.equal(line.includes('Not read yet'), false);
      }
    }
  });

  it('checks display-name shape only', () => {
    assert.equal(isDisplayName('ada'), true);
    assert.equal(isDisplayName('a'), false);
    assert.equal(isDisplayName('ada lovelace'), false);
  });
});

describe('evm calls', () => {
  it('reads an erc20 transfer destination', () => {
    const data =
      '0xa9059cbb00000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000001' as Hex;
    const serialized = serializeTransaction({
      chainId: 84532,
      nonce: 0,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
      gas: 21000n,
      to: '0x2222222222222222222222222222222222222222',
      value: 0n,
      data,
      type: 'eip1559',
    });
    const call = evmCallFromSerialized(serialized);
    assert.deepEqual(evmDestinations(call), ['0x2222222222222222222222222222222222222222']);
    assert.equal(call.token?.raw, 1n);
  });
});
