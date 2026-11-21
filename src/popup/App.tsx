import { useEffect, useRef, useState } from 'react';
import { buildPairPrompt, BIND_TOKEN_PATTERN, createPairCode } from '../../shared/prompt.ts';
import { isAllowlistAddress } from '../../shared/money.ts';
import { hasAppId } from '../../shared/store.ts';
import { t } from '../../shared/i18n.ts';
import type { Lang, Store } from '../../shared/types.ts';
import { resolveCluster } from '../../shared/chains.ts';
import { readClusterBalance } from '../lib/balances.ts';
import { bridgePost, updateStore } from '../lib/storage.ts';
import { PrivyGate, useVault } from '../privy/useVault.tsx';
import { AddressPopover } from '../ui/AddressPopover.tsx';
import { AssetList } from '../ui/AssetList.tsx';
import { useExtensionStore } from './useStore.ts';

export function App({ surface }: { surface: 'popup' | 'auth' }) {
  const store = useExtensionStore();
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
      <header className="header">
        <img src={icon()} alt="" />
        <h1>{t(store.language, 'mark')}</h1>
      </header>
      <div className="main">
        <h2>{t(store.language, 'setupTitle')}</h2>
        <p className="note">{t(store.language, 'setupBody')}</p>
        <p className="note">
          {t(store.language, 'extensionId')} {extensionId}
        </p>
        <p className="note">
          {t(store.language, 'redirectUrl')} {redirect}
        </p>
        <label className="field">
          <span>{t(store.language, 'privyAppId')}</span>
          <input value={appId} onChange={(event) => setAppId(event.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>
            {t(store.language, 'privyClientId')} ({t(store.language, 'optional')})
          </span>
          <input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />
        </label>
        <button
          type="button"
          className="action"
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
        <button
          type="button"
          className="action"
          onClick={() => {
            if (surface === 'auth') {
              void vault.googleLogin.initOAuth({ provider: 'google' });
              return;
            }
            void chrome.windows.create({
              url: chrome.runtime.getURL('auth.html'),
              type: 'popup',
              width: 420,
              height: 720,
              focused: true,
            });
          }}
        >
          {t(lang, 'continueGmail')}
        </button>
        <label className="field">
          <span>{t(lang, 'email')}</span>
          <input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button
          type="button"
          className="action"
          disabled={busy || !email.includes('@')}
          onClick={() => {
            setError(null);
            void send(email.trim());
          }}
        >
          {t(lang, 'sendCode')}
        </button>
        <label className="field">
          <span>{t(lang, 'code')}</span>
          <input value={code} inputMode="numeric" autoComplete="one-time-code" onChange={(event) => setCode(event.target.value)} />
        </label>
        <button
          type="button"
          className="action"
          disabled={busy || code.trim().length < 4}
          onClick={() => {
            setError(null);
            void confirm(code.trim());
          }}
        >
          {t(lang, 'confirmCode')}
        </button>
        {notice ? <p className="note">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
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

function Console({ store, logout }: { store: Store; logout: () => void }) {
  const lang = store.language;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const refresh = async () => {
    for (const snapshot of store.snapshots) {
      const cluster = resolveCluster(snapshot.chain, snapshot.network);
      const rpcUrl = store.settings.rpc[cluster.rpcKey];
      if (!rpcUrl) continue;
      const next = await readClusterBalance({
        chain: snapshot.chain,
        network: snapshot.network,
        solanaAddress: store.addresses?.solana ?? null,
        evmAddress: store.addresses?.evm ?? null,
        rpcUrl,
        now: Date.now(),
      });
      await updateStore((current) => ({
        ...current,
        snapshots: [
          ...current.snapshots.filter((item) => item.chain !== next.chain || item.network !== next.network),
          next,
        ],
      }));
    }
  };

  return (
    <main className="shell">
      <header className="header">
        <img src={icon()} alt="" />
        <h1>{t(lang, 'mark')}</h1>
        <button type="button" className="text-action" onClick={() => setSettingsOpen(true)}>
          {t(lang, 'settings')}
        </button>
      </header>
      <AddressPopover
        lang={lang}
        username={store.username}
        solana={store.addresses?.solana ?? null}
        evm={store.addresses?.evm ?? null}
      />
      {store.policy.agentsPaused ? (
        <div className="paused">
          <span>{t(lang, 'paused')}</span>
          <button
            type="button"
            onClick={() => {
              void updateStore((current) => ({ ...current, policy: { ...current.policy, agentsPaused: false } }));
            }}
          >
            {t(lang, 'resume')}
          </button>
        </div>
      ) : null}
      <div className="main">
        {store.vaultError ? <p className="error">{store.vaultError}</p> : null}
        {store.agents.length === 0 ? (
          <BindPanel
            lang={lang}
            prompt={store.pair ? buildPairPrompt(store.pair.code) : ''}
            showPrompt={showPrompt}
            copied={copied}
            token={token}
            error={error}
            onTogglePrompt={() => setShowPrompt((value) => !value)}
            onCopy={() => void copyPrompt()}
            onToken={setToken}
            onBind={() => void bind()}
          />
        ) : null}
        <AssetList lang={lang} snapshots={store.snapshots} onRefresh={store.snapshots.length ? () => void refresh() : null} />
        <section className="block">
          <h2>{t(lang, 'agents')}</h2>
          {store.agents.length === 0 ? <p className="note">{t(lang, 'noAgents')}</p> : null}
          {store.agents.map((agent) => (
            <div className="row" key={agent.id}>
              <span>{agent.name}</span>
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  void unbind(store, agent.token);
                }}
              >
                {t(lang, 'unbind')}
              </button>
            </div>
          ))}
          {store.agents.length > 0 ? (
            <BindPanel
              lang={lang}
              prompt={store.pair ? buildPairPrompt(store.pair.code) : ''}
              showPrompt={showPrompt}
              copied={copied}
              token={token}
              error={error}
              onTogglePrompt={() => setShowPrompt((value) => !value)}
              onCopy={() => void copyPrompt()}
              onToken={setToken}
              onBind={() => void bind()}
            />
          ) : null}
        </section>
        <section className="block">
          <h2>{t(lang, 'activity')}</h2>
          {store.activity.length === 0 ? <p className="note">{t(lang, 'noActivity')}</p> : null}
          {store.activity.map((item) => (
            <div className="asset" key={item.id}>
              <span>
                {item.method} · {item.chain} · {item.network}
                <span className="meta"> {item.detail}</span>
              </span>
            </div>
          ))}
        </section>
        <button type="button" className="action" onClick={logout}>
          {t(lang, 'logout')}
        </button>
      </div>
      {settingsOpen ? <Settings store={store} onClose={() => setSettingsOpen(false)} /> : null}
    </main>
  );
}

function BindPanel(props: {
  lang: Lang;
  prompt: string;
  showPrompt: boolean;
  copied: boolean;
  token: string;
  error: string | null;
  onTogglePrompt: () => void;
  onCopy: () => void;
  onToken: (value: string) => void;
  onBind: () => void;
}) {
  return (
    <section className="block">
      <h2>{t(props.lang, 'bindTitle')}</h2>
      <p className="note">{t(props.lang, 'bindIntro')}</p>
      <button type="button" className="action" onClick={props.onCopy}>
        {props.copied ? t(props.lang, 'promptCopied') : t(props.lang, 'copyPrompt')}
      </button>
      {props.prompt ? (
        <button type="button" className="text-action" onClick={props.onTogglePrompt}>
          {props.showPrompt ? t(props.lang, 'hidePrompt') : t(props.lang, 'showPrompt')}
        </button>
      ) : null}
      {props.showPrompt && props.prompt ? <pre className="prompt">{props.prompt}</pre> : null}
      <label className="field">
        <span>{t(props.lang, 'tokenLabel')}</span>
        <input value={props.token} onChange={(event) => props.onToken(event.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <button type="button" className="action" onClick={props.onBind}>
        {t(props.lang, 'bindAction')}
      </button>
      {props.error ? <p className="error">{props.error}</p> : null}
    </section>
  );
}

function Settings({ store, onClose }: { store: Store; onClose: () => void }) {
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

  const saveAccount = () => {
    if (!/^[\p{L}\p{N}_]{2,24}$/u.test(username)) {
      setError(t(lang, 'invalidUsername'));
      return;
    }
    setError(null);
    void updateStore((current) => ({
      ...current,
      username,
      settings: { ...current.settings, privyAppId: appId.trim(), privyClientId: clientId.trim(), bridgeToken: bridgeToken.trim() },
    }));
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <button type="button" className="text-action" onClick={onClose}>
          {t(lang, 'settings')}
        </button>
        <p className="label">{t(lang, 'language')}</p>
        <div className="choices">
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
        <label className="field">
          <span>{t(lang, 'username')}</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <p className="note">{t(lang, 'usernameHint')}</p>
        <section className="block">
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
              <label className="field">
                <span>{t(lang, 'singleLimit')}</span>
                <input value={single} inputMode="decimal" onChange={(event) => setSingle(event.target.value)} />
              </label>
              <label className="field">
                <span>{t(lang, 'dailyLimit')}</span>
                <input value={daily} inputMode="decimal" onChange={(event) => setDaily(event.target.value)} />
              </label>
              <button
                type="button"
                className="action"
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
          <label className="field">
            <span>{t(lang, 'address')}</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} spellCheck={false} />
          </label>
          <label className="field">
            <span>{t(lang, 'label')}</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <button
            type="button"
            className="action"
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
            className="action"
            onClick={() => {
              void updateStore((current) => ({
                ...current,
                policy: { ...current.policy, agentsPaused: !current.policy.agentsPaused },
              }));
            }}
          >
            {store.policy.agentsPaused ? t(lang, 'resume') : t(lang, 'pause')}
          </button>
        </section>
        <section className="block">
          <h2>{t(lang, 'bridge')}</h2>
          <p className="note">{store.bridge.connected ? t(lang, 'bridgeConnected') : t(lang, 'bridgeDisconnected')}</p>
          {store.bridge.error ? <p className="error">{store.bridge.error}</p> : null}
          <p className="note">{t(lang, 'bridgeHelp')}</p>
          <label className="field">
            <span>{t(lang, 'bridgeToken')}</span>
            <input value={bridgeToken} onChange={(event) => setBridgeToken(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="field">
            <span>{t(lang, 'privyAppId')}</span>
            <input value={appId} onChange={(event) => setAppId(event.target.value)} autoComplete="off" />
          </label>
          <label className="field">
            <span>{t(lang, 'privyClientId')}</span>
            <input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />
          </label>
          <p className="note">{t(lang, 'clientIdHint')}</p>
          <p className="note">
            {t(lang, 'extensionId')} {chrome.runtime.id}
          </p>
          <p className="note">
            {t(lang, 'redirectUrl')} https://{chrome.runtime.id}.chromiumapp.org/
          </p>
          <button type="button" className="action" onClick={saveAccount}>
            {t(lang, 'save')}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </section>
      </aside>
    </>
  );
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
  return chrome.runtime.getURL('icons/icon-48.png');
}
