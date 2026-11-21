import '../buffer-polyfill.ts';
import '../fonts.ts';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { nativeAsset } from '../../shared/assets.ts';
import { t } from '../../shared/i18n.ts';
import type { Lang, Snapshot, Store } from '../../shared/types.ts';
import { defaultStore } from '../../shared/store.ts';
import { AssetHome } from '../ui/AssetHome.tsx';
import { brandIcon } from '../ui/brand.ts';
import { BindScreen } from '../ui/BindScreen.tsx';
import { LoginScreen } from '../ui/LoginScreen.tsx';
import { SettingsPanel } from '../ui/SettingsPanel.tsx';
import '../popup/styles.css';

document.documentElement.classList.add('preview');

const params = new URLSearchParams(location.search);
const state = params.get('state') ?? 'login';
const lang = (params.get('lang') ?? 'zh-CN') as Lang;

const solana = '9f2kRaaaaaaaaaaaaaaaaaaLm4uC';
const evm = '0xA41c1111111111111111111111111111111192eB';

function snap(chain: Snapshot['chain'], amount: bigint, extra: Snapshot['assets'] = []): Snapshot {
  return {
    chain,
    network: 'mainnet',
    status: 'ready',
    error: null,
    tokenListError: null,
    assets: [nativeAsset(chain, amount), ...extra],
    readAt: 1,
  };
}

const usdc = {
  symbol: 'USDC',
  name: 'USD Coin',
  amount: '0',
  raw: '1',
  decimals: 6,
  contract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  native: false,
  usd: null,
};

const ready: Snapshot[] = [
  snap('solana', 0n, [usdc]),
  snap('ethereum', 0n),
  snap('base', 0n, [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      amount: '12.5',
      raw: '12500000',
      decimals: 6,
      contract: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      native: false,
      usd: null,
    },
  ]),
  snap('bnb', 0n),
];

const errored: Snapshot[] = [
  snap('solana', 0n),
  {
    chain: 'ethereum',
    network: 'mainnet',
    status: 'error',
    error: 'eth_getBalance failed (429).',
    tokenListError: null,
    assets: [],
    readAt: 1,
  },
  snap('base', 0n),
  snap('bnb', 0n),
];

const labels: Record<string, string> = {
  login: 'Fixture: signed-out login.',
  wallet: 'Fixture: Solana home. Sample amounts, not a live wallet.',
  picker: 'Fixture: network picker open. Solana and EVM only.',
  evm: 'Fixture: EVM home. Ethereum, Base, and BNB share one address.',
  error: 'Fixture: Ethereum read failed. That row is an error, not a zero balance.',
  loading: 'Fixture: balances still loading. Amounts are hidden.',
  bind: 'Fixture: first-run bind gate. Assets are not reachable.',
  settings: 'Fixture: settings. No bridge token field.',
  approval: 'Fixture: test-network send waiting for confirmation.',
};

const label = document.getElementById('label');
if (label) label.textContent = labels[state] ?? `Fixture: ${state}`;

function Preview() {
  const [tab, setTab] = useState<'wallet' | 'agent' | 'settings'>(state === 'settings' ? 'settings' : 'wallet');
  if (state === 'login') {
    return (
      <LoginScreen
        lang={lang}
        email=""
        code=""
        phase="idle"
        notice={null}
        error={null}
        onEmail={() => undefined}
        onCode={() => undefined}
        onSend={() => undefined}
        onConfirm={() => undefined}
        onGoogle={() => undefined}
      />
    );
  }
  if (state === 'bind') {
    return (
      <main className="shell">
        <header className="top">
          <img src={brandIcon(32)} alt="" />
          <h1 className="brand">{t(lang, 'mark')}</h1>
        </header>
        <div className="body">
          <BindScreen
            lang={lang}
            token=""
            copied={false}
            error={null}
            onToken={() => undefined}
            onCopy={() => undefined}
            onBind={() => undefined}
            onLanguage={() => undefined}
            onLogout={() => undefined}
          />
        </div>
      </main>
    );
  }
  const snapshots = state === 'loading' ? [] : state === 'error' ? errored : ready;
  return (
    <main className="shell">
      <header className="top">
        <img src={brandIcon(32)} alt="" />
        <h1 className="brand">{t(lang, 'mark')}</h1>
      </header>
      {state === 'approval' ? (
        <div className="banner">
          <p>Claude asked to send on Base Sepolia. This is a test network. Nothing is signed until you confirm.</p>
          <div className="actions">
            <button type="button" className="quiet-button">
              {t(lang, 'rejectTestnet')}
            </button>
            <button type="button" className="quiet-button">
              {t(lang, 'confirmTestnet')}
            </button>
          </div>
        </div>
      ) : null}
      <div className="body">
        {tab === 'wallet' ? (
          <AssetHome
            lang={lang}
            username="timmy"
            solana={state === 'loading' ? null : solana}
            evm={state === 'loading' ? null : evm}
            snapshots={snapshots}
            pending={state === 'loading'}
            walletsReady={state !== 'loading'}
            onRefresh={() => undefined}
            initialHome={state === 'evm' || state === 'error' ? 'evm' : 'solana'}
            forceOpen={state === 'picker'}
          />
        ) : null}
        {tab === 'settings' ? <SettingsPreview lang={lang} /> : null}
      </div>
      <nav className="dock" aria-label={t(lang, 'primaryNav')}>
        <div className="dock-pill">
          {(['wallet', 'agent', 'settings'] as const).map((id) => (
            <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              {t(lang, id === 'wallet' ? 'navWallet' : id === 'agent' ? 'navAgent' : 'navSettings')}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function SettingsPreview({ lang: language }: { lang: Lang }) {
  const store: Store = {
    ...defaultStore(),
    language,
    username: 'timmy',
    agents: [{ id: '1', name: 'timmy-agent', token: 'spx_bind_aa', boundAt: 1 }],
  };
  return <SettingsPanel store={store} logout={() => undefined} />;
}

createRoot(document.getElementById('root') as HTMLElement).render(<Preview />);
