import '../buffer-polyfill.ts';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/jetbrains-mono/400.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { nativeAsset } from '../../shared/assets.ts';
import { t } from '../../shared/i18n.ts';
import type { Lang, Snapshot } from '../../shared/types.ts';
import { AddressPopover } from '../ui/AddressPopover.tsx';
import { AssetList } from '../ui/AssetList.tsx';
import { NavIcon } from '../ui/icons.tsx';
import '../popup/styles.css';

document.documentElement.classList.add('preview');

const params = new URLSearchParams(location.search);
const state = params.get('state') ?? 'login';
const lang = (params.get('lang') ?? 'en') as Lang;

const solana = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const evm = '0x1111111111111111111111111111111111111111';

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

const ready: Snapshot[] = [
  snap('solana', 1_500_000_000n),
  snap('ethereum', 20_000_000_000_000_000n),
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
  login: 'Fixture: signed-out login. No account data.',
  loading: 'Fixture: mainnet read in progress. Amounts are not balances yet.',
  wallet: 'Fixture: sample mainnet balances, not a live wallet. USDC has no invented USD price.',
  popover: 'Fixture: sample addresses. Copy does not use a real account.',
  error: 'Fixture: Ethereum mainnet RPC failed. That row is an error, not a zero balance.',
  zero: 'Fixture: successful mainnet reads that returned zero.',
  agent: 'Fixture: agent setup before any bridge token is saved.',
  approval: 'Fixture: explicit Base Sepolia send waiting for confirmation. Nothing is signed.',
  activity: 'Fixture: empty activity. No invented history.',
  'activity-item': 'Fixture: one sample activity row, not a broadcast transaction.',
  settings: 'Fixture: settings. Bridge token field is empty on purpose.',
  paused: 'Fixture: agents paused. Sample balances.',
};

const label = document.getElementById('label');
if (label) label.textContent = labels[state] ?? `Fixture: ${state}`;

function Preview() {
  const [tab, setTab] = useState<'wallet' | 'agent' | 'activity' | 'settings'>(
    state === 'agent' || state === 'approval' ? 'agent' : state === 'activity' || state === 'activity-item' ? 'activity' : state === 'settings' ? 'settings' : 'wallet',
  );
  if (state === 'login') return <LoginPreview />;
  return (
    <main className="shell">
      <header className="top">
        <img src="/icons/icon-32.png" alt="" />
        <div>
          <h1 className="brand">{t(lang, 'mark')}</h1>
          <p className="cluster-label">{t(lang, 'mainnet')}</p>
        </div>
      </header>
      {state === 'paused' ? (
        <div className="banner">
          <p>{t(lang, 'paused')}</p>
          <button type="button" className="quiet-button">
            {t(lang, 'resume')}
          </button>
        </div>
      ) : null}
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
          <>
            <AddressPopover
              lang={lang}
              username="ada"
              solana={state === 'loading' ? null : solana}
              evm={state === 'loading' ? null : evm}
              forceOpen={state === 'popover'}
            />
            <AssetList
              lang={lang}
              snapshots={snapshotsFor(state)}
              pending={state === 'loading'}
              walletsReady={state !== 'loading'}
              onRefresh={() => undefined}
            />
          </>
        ) : null}
        {tab === 'agent' ? <AgentPreview lang={lang} connected={false} /> : null}
        {tab === 'activity' ? <ActivityPreview lang={lang} item={state === 'activity-item'} /> : null}
        {tab === 'settings' ? <SettingsPreview lang={lang} /> : null}
      </div>
      <nav className="nav" aria-label={t(lang, 'primaryNav')}>
        {(['wallet', 'agent', 'activity', 'settings'] as const).map((id) => (
          <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <NavIcon name={id} />
            {t(lang, id === 'wallet' ? 'navWallet' : id === 'agent' ? 'navAgent' : id === 'activity' ? 'navActivity' : 'navSettings')}
          </button>
        ))}
      </nav>
    </main>
  );
}

function snapshotsFor(name: string): Snapshot[] {
  if (name === 'loading') return [];
  if (name === 'error') return errored;
  if (name === 'zero') return [snap('solana', 0n), snap('ethereum', 0n), snap('base', 0n), snap('bnb', 0n)];
  if (name === 'wallet' || name === 'popover' || name === 'paused' || name === 'activity-item') return ready;
  return ready;
}

function LoginPreview() {
  return (
    <main className="shell">
      <div className="login">
        <img src="/icons/icon-48.png" alt="" />
        <h1>{t(lang, 'appName')}</h1>
        <p className="note">{t(lang, 'loginNote')}</p>
        <button type="button" className="primary">
          {t(lang, 'continueGmail')}
        </button>
        <label className="field" htmlFor="email">
          <span>{t(lang, 'email')}</span>
          <input id="email" type="email" autoComplete="email" defaultValue="" />
        </label>
        <button type="button" className="secondary" disabled>
          {t(lang, 'sendCode')}
        </button>
      </div>
    </main>
  );
}

function AgentPreview({ lang: language, connected }: { lang: Lang; connected: boolean }) {
  return (
    <section className="panel">
      <h2>{t(language, 'bindTitle')}</h2>
      <p className="note">{connected ? t(language, 'bridgeConnected') : t(language, 'bridgeMissing')}</p>
      <p className="note">{t(language, 'bindIntro')}</p>
      <button type="button" className="primary">
        {t(language, 'copyPrompt')}
      </button>
      <label className="field" htmlFor="token">
        <span>{t(language, 'tokenLabel')}</span>
        <input id="token" autoComplete="off" defaultValue="" />
      </label>
      <button type="button" className="secondary">
        {t(language, 'bindAction')}
      </button>
      <h2>{t(language, 'agents')}</h2>
      <p className="note">{t(language, 'noAgents')}</p>
    </section>
  );
}

function ActivityPreview({ lang: language, item }: { lang: Lang; item: boolean }) {
  return (
    <section className="panel">
      <h2>{t(language, 'activity')}</h2>
      {item ? (
        <ul className="activity-list" role="list">
          <li role="listitem">
            <span>Balance · Ethereum Mainnet</span>
            <p className="note">Balance read.</p>
          </li>
        </ul>
      ) : (
        <p className="note">{t(language, 'noActivity')}</p>
      )}
    </section>
  );
}

function SettingsPreview({ lang: language }: { lang: Lang }) {
  return (
    <section className="panel">
      <h2>{t(language, 'settings')}</h2>
      <p className="label">{t(language, 'language')}</p>
      <div className="choices">
        <button type="button" aria-pressed={language === 'zh-CN'}>
          简体中文
        </button>
        <button type="button" aria-pressed={language === 'zh-TW'}>
          繁體中文
        </button>
        <button type="button" aria-pressed={language === 'en'}>
          English
        </button>
      </div>
      <label className="field" htmlFor="name">
        <span>{t(language, 'username')}</span>
        <input id="name" defaultValue="ada" aria-describedby="hint" />
      </label>
      <p className="note" id="hint">
        {t(language, 'usernameHint')}
      </p>
      <h2>{t(language, 'risk')}</h2>
      <div className="choices">
        <button type="button" aria-pressed="true">
          {t(language, 'fullAccess')}
        </button>
        <button type="button" aria-pressed="false">
          {t(language, 'useLimits')}
        </button>
      </div>
      <p className="note">{t(language, 'fullAccessHelp')}</p>
      <h2>{t(language, 'bridge')}</h2>
      <p className="note">{t(language, 'bridgeDisconnected')}</p>
      <label className="field" htmlFor="bridge">
        <span>{t(language, 'bridgeToken')}</span>
        <input id="bridge" type="password" defaultValue="" autoComplete="off" />
      </label>
    </section>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<Preview />);
