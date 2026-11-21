import { useEffect, useRef, useState } from 'react';
import { BIND_TOKEN_PATTERN, buildInstallNote, createPairCode } from '../../shared/prompt.ts';
import { hasAppId, walletReady } from '../../shared/store.ts';
import { t, testnetConfirmCopy } from '../../shared/i18n.ts';
import type { Lang, Store } from '../../shared/types.ts';
import { copyText } from '../lib/copyText.ts';
import { bridgePost, ensureBridgeToken, updateStore } from '../lib/storage.ts';
import { PrivyGate, useVault } from '../privy/useVault.tsx';
import { AssetHome } from '../ui/AssetHome.tsx';
import { brandIcon } from '../ui/brand.ts';
import { Banner, BindScreen, CopyFallback } from '../ui/BindScreen.tsx';
import { LoginScreen, type OtpPhase } from '../ui/LoginScreen.tsx';
import { SettingsPanel } from '../ui/SettingsPanel.tsx';
import { useExtensionStore } from './useStore.ts';
import { useMainnetBalances } from './useMainnet.ts';

type Tab = 'wallet' | 'agent' | 'settings';

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
        <img src={brandIcon(32)} alt="" />
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
  if (!walletReady(store)) {
    return <BindGate store={store} logout={() => void vault.logout()} />;
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
  const [phase, setPhase] = useState<OtpPhase>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <LoginScreen
      lang={lang}
      email={email}
      code={code}
      phase={phase}
      notice={notice}
      error={error}
      onEmail={setEmail}
      onCode={setCode}
      onSend={() => {
        if (!email.includes('@')) return;
        setError(null);
        setNotice(null);
        void send(email.trim());
      }}
      onConfirm={() => {
        setError(null);
        void confirm(code.trim());
      }}
      onGoogle={() => void startGoogle(surface, vault)}
    />
  );

  async function send(value: string): Promise<void> {
    setPhase('sending');
    try {
      await vault.emailLogin.sendCode({ email: value });
      setPhase('sent');
      setNotice(t(lang, 'codeSent'));
    } catch (reason) {
      setPhase('idle');
      setNotice(null);
      setError(reason instanceof Error ? reason.message : t(lang, 'vaultError'));
    }
  }

  async function confirm(value: string): Promise<void> {
    setPhase('confirming');
    try {
      await vault.emailLogin.loginWithCode({ code: value });
    } catch (reason) {
      setPhase('sent');
      setError(reason instanceof Error ? reason.message : t(lang, 'vaultError'));
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

function BindGate({ store, logout }: { store: Store; logout: () => void }) {
  const pairing = usePairing(store);
  return (
    <main className="shell">
      <BrandHeader lang={store.language} />
      <ApprovalBanner store={store} />
      <div className="body">
        {store.vaultError ? (
          <p className="error" role="alert">
            {store.vaultError}
          </p>
        ) : null}
        <BindScreen
          lang={store.language}
          token={pairing.token}
          copied={pairing.copied}
          error={pairing.error}
          fallback={pairing.fallback}
          onToken={pairing.setToken}
          onCopy={() => void pairing.copyPrompt()}
          onBind={() => void pairing.bind()}
          onLanguage={(language) => {
            void updateStore((current) => ({ ...current, language }));
          }}
          onLogout={logout}
        />
      </div>
    </main>
  );
}

function Console({ store, logout }: { store: Store; logout: () => void }) {
  const lang = store.language;
  const [tab, setTab] = useState<Tab>('wallet');
  const balances = useMainnetBalances(store);
  const walletsReady = Boolean(store.addresses?.solana || store.addresses?.evm);

  return (
    <main className="shell">
      <BrandHeader lang={lang} />
      {store.policy.agentsPaused ? (
        <Banner>
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
        </Banner>
      ) : null}
      <ApprovalBanner store={store} />
      <div className="body">
        {store.vaultError ? (
          <p className="error" role="alert">
            {store.vaultError}
          </p>
        ) : null}
        {tab === 'wallet' ? (
          <AssetHome
            lang={lang}
            username={store.username}
            solana={store.addresses?.solana ?? null}
            evm={store.addresses?.evm ?? null}
            snapshots={store.snapshots}
            pending={balances.pending}
            walletsReady={walletsReady}
            onRefresh={walletsReady ? balances.refresh : null}
          />
        ) : null}
        {tab === 'agent' ? <AgentPanel store={store} /> : null}
        {tab === 'settings' ? <SettingsPanel store={store} logout={logout} /> : null}
      </div>
      <nav className="dock" aria-label={t(lang, 'primaryNav')}>
        <div className="dock-pill">
          <DockButton id="wallet" tab={tab} lang={lang} label="navWallet" onSelect={setTab} />
          <DockButton id="agent" tab={tab} lang={lang} label="navAgent" onSelect={setTab} />
          <DockButton id="settings" tab={tab} lang={lang} label="navSettings" onSelect={setTab} />
        </div>
      </nav>
    </main>
  );
}

function BrandHeader({ lang }: { lang: Lang }) {
  return (
    <header className="top">
      <img src={brandIcon(32)} alt="" />
      <h1 className="brand">{t(lang, 'mark')}</h1>
    </header>
  );
}

function ApprovalBanner({ store }: { store: Store }) {
  if (!store.pendingApproval) return null;
  return (
    <Banner>
      <p>
        {testnetConfirmCopy(
          store.language,
          store.pendingApproval.method,
          store.pendingApproval.agentName,
          store.pendingApproval.chain,
          store.pendingApproval.network,
        )}
      </p>
      <div className="actions">
        <button type="button" className="quiet-button" onClick={() => void decide(store.pendingApproval?.id ?? '', false)}>
          {t(store.language, 'rejectTestnet')}
        </button>
        <button type="button" className="quiet-button" onClick={() => void decide(store.pendingApproval?.id ?? '', true)}>
          {t(store.language, 'confirmTestnet')}
        </button>
      </div>
    </Banner>
  );
}

function DockButton({
  id,
  tab,
  lang,
  label,
  onSelect,
}: {
  id: Tab;
  tab: Tab;
  lang: Lang;
  label: 'navWallet' | 'navAgent' | 'navSettings';
  onSelect: (tab: Tab) => void;
}) {
  return (
    <button type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => onSelect(id)}>
      {t(lang, label)}
    </button>
  );
}

function usePairing(store: Store) {
  const lang = store.language;
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  const copyPrompt = async () => {
    let pairCode: string | null = null;
    let registered = false;
    let status: string | null = null;
    const settings = await ensureBridgeToken(store.settings);
    if (!settings.bridgeToken) {
      status = t(lang, 'bridgeDown');
    } else {
      const code = createPairCode();
      pairCode = code;
      const expiresAt = Date.now() + 10 * 60 * 1000;
      await updateStore((current) => ({ ...current, pair: { code, expiresAt } }));
      try {
        await bridgePost(settings, '/v1/pair/register', { pairCode: code, expiresAt });
        registered = true;
      } catch (reason) {
        status = reason instanceof Error ? reason.message : t(lang, 'bridgeDown');
      }
    }
    const note = buildInstallNote(pairCode, registered);
    const wrote = await copyText(note);
    setCopied(wrote);
    setFallback(wrote ? null : note);
    setError(status);
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
    const settings = await ensureBridgeToken(store.settings);
    try {
      const json = await bridgePost(settings, '/v1/pair/redeem', {
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

  return { error, token, setToken, copied, fallback, copyPrompt, bind };
}

function AgentPanel({ store }: { store: Store }) {
  const lang = store.language;
  const pairing = usePairing(store);
  return (
    <section className="panel" aria-labelledby="agent-title">
      <h2 id="agent-title">{t(lang, 'agents')}</h2>
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
      <h2>{t(lang, 'bindTitle')}</h2>
      <p className="note">{t(lang, 'bindIntro')}</p>
      <button type="button" className="primary" onClick={() => void pairing.copyPrompt()}>
        {pairing.copied ? t(lang, 'promptCopied') : t(lang, 'copyPrompt')}
      </button>
      {pairing.fallback ? (
        <>
          <p className="error" role="alert">
            {t(lang, 'couldNotCopy')}
          </p>
          <CopyFallback lang={lang} text={pairing.fallback} />
        </>
      ) : null}
      <label className="field" htmlFor="rebind-token">
        <span>{t(lang, 'tokenLabel')}</span>
        <input
          id="rebind-token"
          value={pairing.token}
          onChange={(event) => pairing.setToken(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button type="button" className="primary" onClick={() => void pairing.bind()}>
        {t(lang, 'bindAction')}
      </button>
      {pairing.error ? (
        <p className="error" role="alert">
          {pairing.error}
        </p>
      ) : null}
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
