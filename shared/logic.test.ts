import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serializeTransaction, type Hex } from 'viem';
import { buildAssetGroups, homeChains, nativeAsset, parseBinplorerTokens, parseBlockscoutTokens, parseJupiterHoldings, parseSolanaTokenAccounts } from './assets.ts';
import { browserRpcUrl, resolveCluster } from './chains.ts';
import { evmCallFromSerialized, evmDestinations } from './evmIntent.ts';
import { copyKeys, t } from './i18n.ts';
import { evaluatePolicy } from './policy.ts';
import { buildInstallNote, buildPairPrompt, MCP_TOOL_NAMES } from './prompt.ts';
import { defaultStore, isDisplayName, walletReady } from './store.ts';
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
    assert.equal(browserRpcUrl('solana', 'mainnet', 'https://api.mainnet-beta.solana.com'), 'https://solana-rpc.publicnode.com');
    assert.equal(browserRpcUrl('solana', 'mainnet', 'https://api.mainnet-beta.solana.com/'), 'https://solana-rpc.publicnode.com');
    assert.equal(browserRpcUrl('solana', 'devnet', 'https://api.devnet.solana.com'), 'https://api.devnet.solana.com');
    assert.equal(browserRpcUrl('ethereum', 'mainnet', 'https://ethereum-rpc.publicnode.com'), 'https://ethereum-rpc.publicnode.com');
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

  it('shows one network at a time and does not turn a failed read into zero', () => {
    const ready = homeChains('solana', [
      {
        chain: 'solana',
        network: 'mainnet',
        status: 'ready',
        error: null,
        tokenListError: null,
        readAt: 1,
        assets: [nativeAsset('solana', 0n)],
      },
    ]);
    assert.equal(ready.length, 1);
    assert.equal(ready[0]?.assets[0]?.amount, '0');
    const failed = homeChains('evm', [
      {
        chain: 'ethereum',
        network: 'mainnet',
        status: 'error',
        error: 'eth_getBalance failed (403).',
        tokenListError: null,
        readAt: 1,
        assets: [nativeAsset('ethereum', 0n)],
      },
    ]);
    assert.deepEqual(
      failed.map((item) => item.chain),
      ['ethereum', 'base', 'bnb'],
    );
    assert.equal(failed[0]?.status, 'error');
    assert.equal(failed[0]?.assets.length, 0);
    assert.equal(failed[1]?.status, 'absent');
    assert.equal(failed[1]?.assets.length, 0);
  });

  it('parses Jupiter holdings and Binplorer token lists', () => {
    const sol = parseJupiterHoldings({
      tokens: {
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: [{ amount: '0', decimals: 6, uiAmountString: '0' }],
        Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: [{ amount: '2500000', decimals: 6, uiAmountString: '2.5' }],
      },
    });
    assert.equal(sol.length, 1);
    assert.equal(sol[0]?.symbol, 'USDT');
    assert.equal(sol[0]?.amount, '2.5');
    const bnb = parseBinplorerTokens({
      tokens: [
        { rawBalance: '0', tokenInfo: { address: '0x1', symbol: 'ZERO', decimals: '18', name: 'Zero' } },
        { rawBalance: '1000000000000000000', tokenInfo: { address: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT', decimals: '18', name: 'Tether USD' } },
      ],
    });
    assert.equal(bnb.length, 1);
    assert.equal(bnb[0]?.symbol, 'USDT');
    assert.equal(bnb[0]?.amount, '1');
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
  it('gives the agent one sentence plus a registered pair code', () => {
    const prompt = buildPairPrompt('ABCD2345');
    assert.equal(prompt.split('\n')[0], 'Read https://spacexpad.xyz/agent-wallet/skill.md and set up this SpaceXpad agent wallet.');
    assert.match(prompt, /PAIR_CODE: ABCD2345/);
    assert.match(prompt, /10 minutes/);
    assert.doesNotMatch(prompt, /https:\/\/spacexpad\.xyz\/skill(?:\.md)?/);
    assert.doesNotMatch(prompt, /npm install/);
    assert.doesNotMatch(prompt, /mcp\/src\/index\.ts/);
    assert.doesNotMatch(prompt, /omit network/i);
    assert.doesNotMatch(prompt, /bridge token/i);
    assert.doesNotMatch(prompt, /launchpad/i);
    assert.doesNotMatch(prompt, /spacexpad_pair/);
    assert.equal(prompt.split('\n').length <= 4, true);
    assert.equal(MCP_TOOL_NAMES.includes('spacexpad_pair'), true);
  });

  it('omits the pair code when the local server is down', () => {
    const note = buildInstallNote(null);
    assert.equal(note, 'Read https://spacexpad.xyz/agent-wallet/skill.md and set up this SpaceXpad agent wallet.');
    assert.doesNotMatch(note, /PAIR_CODE/);
  });

  it('keeps the wallet closed until an agent is bound', () => {
    const store = defaultStore();
    assert.equal(walletReady(store), false);
    assert.equal(
      walletReady({ ...store, agents: [{ id: '1', name: 'ada', token: 'spx_bind_aa', boundAt: 1 }] }),
      true,
    );
  });

  it('keeps translations aligned and drops the unread placeholder', () => {
    assert.ok(copyKeys().length > 20);
    for (const key of copyKeys()) {
      for (const lang of ['en', 'zh-CN', 'zh-TW'] as const) {
        const line = t(lang, key);
        assert.equal(line.includes('尚未读取'), false);
        assert.equal(line.includes('尚未讀取'), false);
        assert.equal(line.includes('Not read yet'), false);
        assert.equal(/only on this device/i.test(line), false);
        assert.equal(line.includes('只显示在这台设备上'), false);
        assert.equal(line.includes('只顯示在這台裝置上'), false);
        assert.equal(/paste a bridge token into settings/i.test(line), false);
        assert.equal(line.includes('贴进设置'), false);
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
