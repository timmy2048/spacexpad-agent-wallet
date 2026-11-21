import { useEffect, useRef, useState } from 'react';
import { BIND_TOKEN_PATTERN, buildPairPrompt, createPairCode } from '../../shared/prompt.ts';
import { isAllowlistAddress } from '../../shared/money.ts';
import { hasAppId, isDisplayName } from '../../shared/store.ts';
import { chainName, clusterLabel, t, testnetConfirmCopy } from '../../shared/i18n.ts';
import type { Lang, Store } from '../../shared/types.ts';
import { bridgePost, updateStore } from '../lib/storage.ts';
import { PrivyGate, useVault } from '../privy/useVault.tsx';
import { AddressPopover } from '../ui/AddressPopover.tsx';
import { AssetList } from '../ui/AssetList.tsx';
import { NavIcon } from '../ui/icons.tsx';
import { useExtensionStore } from './useStore.ts';
import { useMainnetBalances } from './useMainnet.ts';

type Tab = 'wallet' | 'agent' | 'activity' | 'settings';

export function App({ surface }: { surface: 'popup' | 'auth' }) {
  const store = useExtensionStore();
  useEffect(() => {
    if (!store) return;
    document.documentElement.lang = store.language;
  }, [store]);
  if (!store) {
    return (
      <main className="shell">
        <p className="note pad">…</p>
      </main>
    );
  }
  if (!hasAppId(store.settings)) return <Setup store={store} />;
  return (
    <PrivyGate appId={store.settings.privyAppId} clientId={store.settings.privyClientId}>
      <Session surface={surface} store={store} />
    </PrivyGate>
  );
}

function Setup({ store }: { store: Store }) {
  const [appId, setAppId] = useState(store.settings.privyAppId);
  const [clientId, setClientId] = useState(store.settings.privyClientId);
  const extensionId = chrome.runtime.id;
  const redirect = `https://${extensionId}.chromiumapp.org/`;
  return (
    <main className="shell">
      <header className="top">
        <img src={icon()} alt="" />
        <h1 className="brand">{t(store.language, 'mark')}</h1>
      </header>
      <div className="body">
        <h2>{t(store.language, 'setupTitle')}</h2>
        <p className="note">{t(store.language, 'setupBody')}</p>
        <p className="note">
          {t(store.language, 'extensionId')} {extensionId}
        </p>
        <p className="note">
          {t(store.language, 'redirectUrl')} {redirect}
        </p>
        <label className="field" htmlFor="setup-app">
          <span>{t(store.language, 'privyAppId')}</span>
          <input id="setup-app" value={appId} onChange={(event) => setAppId(event.target.value)} autoComplete="off" />
        </label>
        <label className="field" htmlFor="setup-client">
          <span>
            {t(store.language, 'privyClientId')} ({t(store.language, 'optional')})
          </span>
          <input id="setup-client" value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />
        </label>
        <button
          type="button"
          className="primary"
          onClick={() => {
            void updateStore((current) => ({
              ...current,
              settings: {
                ...current.settings,
                privyAppId: appId.trim(),
                privyClientId: clientId.trim(),
                hydrated: true,
              },
            }));
          }}
        >
          {t(store.language, 'save')}
        </button>
        {store.settings.configError ? <p className="error">{store.settings.configError}</p> : null}
      </div>
    </main>
  );
}

function Session({ surface, store }: { surface: 'popup' | 'auth'; store: Store }) {
  const vault = useVault();
  const started = useRef(false);
  const lang = store.language;

  useEffect(() => {
    if (surface !== 'auth' || !vault.ready || vault.authenticated || started.current) return;
    started.current = true;
    void vault.googleLogin.initOAuth({ provider: 'google' });
  }, [surface, vault.authenticated, vault.googleLogin, vault.ready]);

  useEffect(() => {
    if (surface !== 'auth' || !vault.authenticated) return;
    let cancel = false;
    const finish = async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'AUTH_CHANGED' });
      } catch {
        // The offscreen page may not be open yet.
      }
      if (!cancel) window.close();
    };
    void finish();
    return () => {
      cancel = true;
    };
  }, [surface, vault.authenticated]);

  if (!vault.ready) {
    return (
      <main className="shell">
        <p className="note pad">{t(lang, 'working')}</p>
      </main>
    );
  }
  if (!vault.authenticated) return <Login surface={surface} lang={lang} vault={vault} />;
  if (surface === 'auth') {
    return (
      <main className="shell">
        <p className="note pad">{t(lang, 'signedInClose')}</p>
      </main>
    );
  }
  return <Console store={store} logout={() => void vault.logout()} />;
}

function Login({
  surface,
  lang,
  vault,
}: {
  surface: 'popup' | 'auth';
  lang: Lang;
  vault: ReturnType<typeof useVault>;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = vault.emailLogin.state.status === 'sending-code' || vault.emailLogin.state.status === 'submitting-code';

  return (
    <main className="shell">
      <div className="login">
        <img src={icon()} alt="" />
        <h1>{t(lang, 'appName')}</h1>
        <p className="note">{t(lang, 'loginNote')}</p>
        <button type="button" className="primary" onClick={() => void startGoogle(surface, vault)}>
          {t(lang, 'continueGmail')}
        </button>
        <label className="field" htmlFor="login-email">
          <span>{t(lang, 'email')}</span>
          <input
            id="login-email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy || !email.includes('@')}
          onClick={() => {
            setError(null);
            void send(email.trim());
          }}
        >
          {t(lang, 'sendCode')}
        </button>
        <label className="field" htmlFor="login-code">
          <span>{t(lang, 'code')}</span>
          <input
            id="login-code"
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={busy || code.trim().length < 4}
          onClick={() => {
            setError(null);
            void confirm(code.trim());
          }}
        >
          {t(lang, 'confirmCode')}
        </button>
        {notice ? <p className="note">{notice}</p> : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );

  async function send(value: string): Promise<void> {
    try {
      await vault.emailLogin.sendCode({ email: value });
      setNotice(t(lang, 'codeSent'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed.');
    }
  }

  async function confirm(value: string): Promise<void> {
    try {
      await vault.emailLogin.loginWithCode({ code: value });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed.');
    }
  }
}

async function startGoogle(surface: 'popup' | 'auth', vault: ReturnType<typeof useVault>): Promise<void> {
  if (surface === 'auth') {
    await vault.googleLogin.initOAuth({ provider: 'google' });
    return;
  }
  await chrome.windows.create({
    url: chrome.runtime.getURL('auth.html'),
    type: 'popup',
    width: 420,
    height: 720,
    focused: true,
  });
}

function Console({ store, logout }: { store: Store; logout: () => void }) {
  const lang = store.language;
  const [tab, setTab] = useState<Tab>('wallet');
  const balances = useMainnetBalances(store);
  const walletsReady = Boolean(store.addresses?.solana || store.addresses?.evm);

  return (
    <main className="shell">
      <header className="top">
        <img src={icon()} alt="" />
        <div>
          <h1 className="brand">{t(lang, 'mark')}</h1>
          <p className="cluster-label">{t(lang, 'mainnet')}</p>
        </div>
      </header>
      {store.policy.agentsPaused ? (
        <div className="banner">
          <p>{t(lang, 'paused')}</p>
          <button
            type="button"
            className="quiet-button"
            onClick={() => {
              void updateStore((current) => ({ ...current, policy: { ...current.policy, agentsPaused: false } }));
            }}
          >
            {t(lang, 'resume')}
          </button>
        </div>
      ) : null}
      {store.pendingApproval ? (
        <div className="banner">
          <p>
            {testnetConfirmCopy(
              lang,
              store.pendingApproval.method,
              store.pendingApproval.agentName,
              store.pendingApproval.chain,
              store.pendingApproval.network,
            )}
          </p>
          <div className="actions">
            <button type="button" className="quiet-button" onClick={() => void decide(store.pendingApproval?.id ?? '', false)}>
              {t(lang, 'rejectTestnet')}
            </button>
            <button type="button" className="quiet-button" onClick={() => void decide(store.pendingApproval?.id ?? '', true)}>
              {t(lang, 'confirmTestnet')}
            </button>
          </div>
        </div>
      ) : null}
      <div className="body">
        {store.vaultError ? (
          <p className="error" role="alert">
            {store.vaultError}
          </p>
        ) : null}
        {tab === 'wallet' ? (
          <>
            <AddressPopover
              lang={lang}
              username={store.username}
              solana={store.addresses?.solana ?? null}
              evm={store.addresses?.evm ?? null}
            />
            <AssetList
              lang={lang}
              snapshots={store.snapshots}
              pending={balances.pending}
              walletsReady={walletsReady}
              onRefresh={walletsReady ? balances.refresh : null}
            />
          </>
        ) : null}
        {tab === 'agent' ? <AgentPanel store={store} /> : null}
        {tab === 'activity' ? <ActivityPanel store={store} /> : null}
        {tab === 'settings' ? <Settings store={store} logout={logout} /> : null}
      </div>
      <nav className="nav" aria-label={t(lang, 'primaryNav')}>
        <NavButton id="wallet" tab={tab} lang={lang} label="navWallet" onSelect={setTab} />
        <NavButton id="agent" tab={tab} lang={lang} label="navAgent" onSelect={setTab} />
        <NavButton id="activity" tab={tab} lang={lang} label="navActivity" onSelect={setTab} />
        <NavButton id="settings" tab={tab} lang={lang} label="navSettings" onSelect={setTab} />
      </nav>
    </main>
  );
}

function NavButton({
  id,
  tab,
  lang,
  label,
  onSelect,
}: {
  id: Tab;
  tab: Tab;
  lang: Lang;
  label: 'navWallet' | 'navAgent' | 'navActivity' | 'navSettings';
  onSelect: (tab: Tab) => void;
}) {
  const icon = id === 'wallet' ? 'wallet' : id === 'agent' ? 'agent' : id === 'activity' ? 'activity' : 'settings';
  return (
    <button type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => onSelect(id)}>
      <NavIcon name={icon} />
      {t(lang, label)}
    </button>
  );
}

function AgentPanel({ store }: { store: Store }) {
  const lang = store.language;
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const prompt = store.pair ? buildPairPrompt(store.pair.code) : '';

  const copyPrompt = async () => {
    const code = createPairCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await updateStore((current) => ({ ...current, pair: { code, expiresAt } }));
    try {
      await bridgePost(store.settings, '/v1/pair/register', { pairCode: code, expiresAt });
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t(lang, 'awaitingBridge'));
    }
    await navigator.clipboard.writeText(buildPairPrompt(code));
    setCopied(true);
    setShowPrompt(true);
  };

  const bind = async () => {
    const value = token.trim();
    if (!BIND_TOKEN_PATTERN.test(value)) {
      setError(t(lang, 'tokenRejected'));
      return;
    }
    if (!store.pair || store.pair.expiresAt < Date.now()) {
      setError(t(lang, 'pairExpired'));
      return;
    }
    try {
      const json = await bridgePost(store.settings, '/v1/pair/redeem', {
        pairCode: store.pair.code,
        bindToken: value,
      });
      await updateStore((current) => ({
        ...current,
        pair: null,
        agents: [
          ...current.agents,
          {
            id: String(json.agentId),
            name: String(json.agentName || 'Agent'),
            token: value,
            boundAt: Date.now(),
          },
        ],
      }));
      setToken('');
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t(lang, 'tokenRejected'));
    }
  };

  return (
    <section className="panel" aria-labelledby="agent-title">
      <h2 id="agent-title">{t(lang, 'bindTitle')}</h2>
      <p className="note">{store.bridge.connected ? t(lang, 'bridgeConnected') : t(lang, 'bridgeMissing')}</p>
      {store.bridge.error ? <p className="error">{store.bridge.error}</p> : null}
      <p className="note">{t(lang, 'bindIntro')}</p>
      <button type="button" className="primary" onClick={() => void copyPrompt()}>
        {copied ? t(lang, 'promptCopied') : t(lang, 'copyPrompt')}
      </button>
      {prompt ? (
        <button type="button" className="quiet-button" onClick={() => setShowPrompt((value) => !value)}>
          {showPrompt ? t(lang, 'hidePrompt') : t(lang, 'showPrompt')}
        </button>
      ) : null}
      {showPrompt && prompt ? <textarea className="prompt" readOnly value={prompt} aria-label={t(lang, 'copyPrompt')} /> : null}
      <label className="field" htmlFor="bind-token">
        <span>{t(lang, 'tokenLabel')}</span>
        <input
          id="bind-token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button type="button" className="secondary" onClick={() => void bind()}>
        {t(lang, 'bindAction')}
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <h2>{t(lang, 'agents')}</h2>
      {store.agents.length === 0 ? <p className="note">{t(lang, 'noAgents')}</p> : null}
      {store.agents.map((agent) => (
        <div className="row" key={agent.id}>
          <span>{agent.name}</span>
          <button
            type="button"
            className="quiet-button"
            onClick={() => {
              void unbind(store, agent.token);
            }}
          >
            {t(lang, 'unbind')}
          </button>
        </div>
      ))}
    </section>
  );
}

function ActivityPanel({ store }: { store: Store }) {
  const lang = store.language;
  return (
    <section className="panel" aria-labelledby="activity-title">
      <h2 id="activity-title">{t(lang, 'activity')}</h2>
      {store.activity.length === 0 ? <p className="note">{t(lang, 'noActivity')}</p> : null}
      <ul className="activity-list" role="list">
        {store.activity.map((item) => (
          <li key={item.id} role="listitem">
            <span>
              {t(lang, item.method === 'balance' ? 'methodBalance' : item.method === 'sign' ? 'methodSign' : 'methodSend')}
              {' · '}
              {chainName(lang, item.chain)} {clusterLabel(lang, item.chain, item.network)}
            </span>
            <p className="note">
              {item.detail}
              {item.hash ? ` ${item.hash.slice(0, 10)}…` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Settings({ store, logout }: { store: Store; logout: () => void }) {
  const lang = store.language;
  const [username, setUsername] = useState(store.username);
  const [single, setSingle] = useState(store.policy.singleTxUsd?.toString() ?? '');
  const [daily, setDaily] = useState(store.policy.dailyUsd?.toString() ?? '');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [appId, setAppId] = useState(store.settings.privyAppId);
  const [clientId, setClientId] = useState(store.settings.privyClientId);
  const [bridgeToken, setBridgeToken] = useState(store.settings.bridgeToken);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveAccount = () => {
    if (!isDisplayName(username)) {
      setError(t(lang, 'invalidUsername'));
      setSaved(false);
      return;
    }
    setError(null);
    setSaved(true);
    void updateStore((current) => ({
      ...current,
      username,
      settings: { ...current.settings, privyAppId: appId.trim(), privyClientId: clientId.trim(), bridgeToken: bridgeToken.trim() },
    }));
  };

  return (
    <section className="panel" aria-labelledby="settings-title">
      <h2 id="settings-title">{t(lang, 'settings')}</h2>
      <p className="label">{t(lang, 'language')}</p>
      <div className="choices" role="group" aria-label={t(lang, 'language')}>
        {(['zh-CN', 'zh-TW', 'en'] as Lang[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={lang === item}
            onClick={() => {
              void updateStore((current) => ({ ...current, language: item }));
            }}
          >
            {item === 'en' ? 'English' : item === 'zh-CN' ? '简体中文' : '繁體中文'}
          </button>
        ))}
      </div>
      <label className="field" htmlFor="display-name">
        <span>{t(lang, 'username')}</span>
        <input
          id="display-name"
          value={username}
          autoComplete="nickname"
          aria-describedby="display-name-hint"
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <p className="note" id="display-name-hint">
        {t(lang, 'usernameHint')}
      </p>
      <h2>{t(lang, 'risk')}</h2>
      <div className="choices">
        <button
          type="button"
          aria-pressed={store.policy.fullAccess}
          onClick={() => {
            void updateStore((current) => ({ ...current, policy: { ...current.policy, fullAccess: true } }));
          }}
        >
          {t(lang, 'fullAccess')}
        </button>
        <button
          type="button"
          aria-pressed={!store.policy.fullAccess}
          onClick={() => {
            void updateStore((current) => ({ ...current, policy: { ...current.policy, fullAccess: false } }));
          }}
        >
          {t(lang, 'useLimits')}
        </button>
      </div>
      <p className="note">{t(lang, 'fullAccessHelp')}</p>
      {store.policy.fullAccess ? null : (
        <>
          <label className="field" htmlFor="single-limit">
            <span>{t(lang, 'singleLimit')}</span>
            <input id="single-limit" value={single} inputMode="decimal" onChange={(event) => setSingle(event.target.value)} />
          </label>
          <label className="field" htmlFor="daily-limit">
            <span>{t(lang, 'dailyLimit')}</span>
            <input id="daily-limit" value={daily} inputMode="decimal" onChange={(event) => setDaily(event.target.value)} />
          </label>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void updateStore((current) => ({
                ...current,
                policy: {
                  ...current.policy,
                  singleTxUsd: single.trim() ? Number(single) : null,
                  dailyUsd: daily.trim() ? Number(daily) : null,
                },
              }));
            }}
          >
            {t(lang, 'save')}
          </button>
        </>
      )}
      <div className="choices">
        <button
          type="button"
          aria-pressed={store.policy.whitelistEnabled}
          onClick={() => {
            void updateStore((current) => ({
              ...current,
              policy: { ...current.policy, whitelistEnabled: !current.policy.whitelistEnabled },
            }));
          }}
        >
          {t(lang, 'whitelist')}
        </button>
      </div>
      <p className="note">{t(lang, 'whitelistHelp')}</p>
      {store.policy.whitelist.length === 0 ? <p className="note">{t(lang, 'whitelistEmpty')}</p> : null}
      {store.policy.whitelist.map((entry) => (
        <div className="row" key={entry.address}>
          <span>
            {entry.label ? `${entry.label} ` : ''}
            <span className="addr">{entry.address}</span>
          </span>
          <button
            type="button"
            className="quiet-button"
            onClick={() => {
              void updateStore((current) => ({
                ...current,
                policy: {
                  ...current.policy,
                  whitelist: current.policy.whitelist.filter((item) => item.address !== entry.address),
                },
              }));
            }}
          >
            {t(lang, 'remove')}
          </button>
        </div>
      ))}
      <label className="field" htmlFor="allow-address">
        <span>{t(lang, 'address')}</span>
        <input id="allow-address" value={address} onChange={(event) => setAddress(event.target.value)} spellCheck={false} autoComplete="off" />
      </label>
      <label className="field" htmlFor="allow-label">
        <span>{t(lang, 'label')}</span>
        <input id="allow-label" value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          if (!isAllowlistAddress(address.trim())) {
            setError(t(lang, 'invalidAddress'));
            return;
          }
          setError(null);
          void updateStore((current) => ({
            ...current,
            policy: {
              ...current.policy,
              whitelist: [...current.policy.whitelist, { address: address.trim(), label: label.trim() }],
            },
          }));
          setAddress('');
          setLabel('');
        }}
      >
        {t(lang, 'add')}
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          void updateStore((current) => ({
            ...current,
            policy: { ...current.policy, agentsPaused: !current.policy.agentsPaused },
          }));
        }}
      >
        {store.policy.agentsPaused ? t(lang, 'resume') : t(lang, 'pause')}
      </button>
      <h2>{t(lang, 'bridge')}</h2>
      <p className="note">{store.bridge.connected ? t(lang, 'bridgeConnected') : t(lang, 'bridgeDisconnected')}</p>
      <p className="note">{t(lang, 'bridgeHelp')}</p>
      <label className="field" htmlFor="bridge-token">
        <span>{t(lang, 'bridgeToken')}</span>
        <input
          id="bridge-token"
          type="password"
          value={bridgeToken}
          onChange={(event) => setBridgeToken(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="field" htmlFor="privy-app">
        <span>{t(lang, 'privyAppId')}</span>
        <input id="privy-app" value={appId} onChange={(event) => setAppId(event.target.value)} autoComplete="off" />
      </label>
      <label className="field" htmlFor="privy-client">
        <span>{t(lang, 'privyClientId')}</span>
        <input id="privy-client" value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />
      </label>
      <p className="note">{t(lang, 'clientIdHint')}</p>
      <p className="note">
        {t(lang, 'extensionId')} {chrome.runtime.id}
      </p>
      <p className="note">
        {t(lang, 'redirectUrl')} https://{chrome.runtime.id}.chromiumapp.org/
      </p>
      <button type="button" className="primary" onClick={saveAccount}>
        {t(lang, 'save')}
      </button>
      {saved ? <p className="note">{t(lang, 'savedQuiet')}</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="secondary" onClick={logout}>
        {t(lang, 'logout')}
      </button>
    </section>
  );
}

async function decide(id: string, allow: boolean): Promise<void> {
  if (!id) return;
  await updateStore((current) => ({ ...current, approval: { id, allow } }));
}

async function unbind(store: Store, token: string): Promise<void> {
  try {
    await bridgePost(store.settings, '/v1/pair/unbind', { bindToken: token });
  } catch {
    // Local removal still stops this extension from signing.
  }
  await updateStore((current) => ({ ...current, agents: current.agents.filter((agent) => agent.token !== token) }));
}

function icon(): string {
  return chrome.runtime.getURL('icons/icon-32.png');
}
