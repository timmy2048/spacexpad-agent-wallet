import { useState } from 'react';
import { chainName, clusterLabel, t } from '../../shared/i18n.ts';
import { isAllowlistAddress } from '../../shared/money.ts';
import { isDisplayName } from '../../shared/store.ts';
import type { Store } from '../../shared/types.ts';
import { updateStore } from '../lib/storage.ts';
import { LanguageChoices } from './BindScreen.tsx';
import { SettingsGlyph, type SettingsIconName } from './icons.tsx';

type Page = 'home' | 'name' | 'language' | 'risk' | 'whitelist' | 'activity' | 'network';

export function SettingsPanel({
  store,
  logout,
  initialPage = 'home',
}: {
  store: Store;
  logout: () => void;
  initialPage?: Page;
}) {
  const lang = store.language;
  const [page, setPage] = useState<Page>(initialPage);
  const [username, setUsername] = useState(store.username);
  const [single, setSingle] = useState(store.policy.singleTxUsd?.toString() ?? '');
  const [daily, setDaily] = useState(store.policy.dailyUsd?.toString() ?? '');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [clientId, setClientId] = useState(store.settings.privyClientId);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const open = (next: Page) => {
    if (next === 'name') {
      setUsername(store.username);
      setClientId(store.settings.privyClientId);
    }
    setError(null);
    setSaved(false);
    setPage(next);
  };

  const chooseView = (assetView: Store['assetView']) => {
    void updateStore((current) => ({ ...current, assetView }));
  };

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
      settings: { ...current.settings, privyClientId: clientId.trim() },
    }));
  };

  if (page === 'home') {
    return (
      <section className="panel" aria-label={t(lang, 'navSettings')}>
        <div className="settings-group">
          <SettingsRow icon="user" label={t(lang, 'username')} onOpen={() => open('name')} />
          <SettingsRow icon="language" label={t(lang, 'language')} onOpen={() => open('language')} />
          <SettingsRow icon="risk" label={t(lang, 'risk')} onOpen={() => open('risk')} />
          <SettingsRow icon="list" label={t(lang, 'whitelist')} onOpen={() => open('whitelist')} />
          <SettingsRow icon="activity" label={t(lang, 'activity')} onOpen={() => open('activity')} />
          <SettingsRow icon="network" label={t(lang, 'viewNetwork')} onOpen={() => open('network')} />
        </div>
        <button type="button" className="secondary logout-home" onClick={logout}>
          {t(lang, 'logout')}
        </button>
      </section>
    );
  }

  const title =
    page === 'name'
      ? t(lang, 'username')
      : page === 'language'
        ? t(lang, 'language')
        : page === 'risk'
          ? t(lang, 'risk')
          : page === 'whitelist'
            ? t(lang, 'whitelist')
            : page === 'activity'
              ? t(lang, 'activity')
              : t(lang, 'viewNetwork');

  return (
    <section className="panel" aria-labelledby="settings-page-title">
      <button id="settings-page-title" type="button" className="back" onClick={() => open('home')}>
        <span aria-hidden="true">‹</span>
        {title}
      </button>
      {page === 'name' ? (
        <>
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
          <label className="field" htmlFor="privy-client">
            <span>
              {t(lang, 'privyClientId')} ({t(lang, 'optional')})
            </span>
            <input id="privy-client" value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />
          </label>
          <p className="note">{t(lang, 'clientIdHint')}</p>
          <button type="button" className="primary" onClick={saveAccount}>
            {t(lang, 'save')}
          </button>
          {saved ? <p className="note">{t(lang, 'savedQuiet')}</p> : null}
        </>
      ) : null}
      {page === 'language' ? (
        <LanguageChoices
          lang={lang}
          onLanguage={(item) => {
            void updateStore((current) => ({ ...current, language: item }));
          }}
        />
      ) : null}
      {page === 'risk' ? (
        <>
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
        </>
      ) : null}
      {page === 'whitelist' ? (
        <>
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
        </>
      ) : null}
      {page === 'network' ? (
        <>
          <p className="note">{t(lang, 'viewNetworkHelp')}</p>
          <div className="choices" role="group" aria-label={t(lang, 'viewNetwork')}>
            <button type="button" aria-pressed={store.assetView !== 'test'} onClick={() => chooseView('mainnet')}>
              {t(lang, 'viewMainnet')}
            </button>
            <button type="button" aria-pressed={store.assetView === 'test'} onClick={() => chooseView('test')}>
              {t(lang, 'viewTest')}
            </button>
          </div>
        </>
      ) : null}
      {page === 'activity' ? (
        <>
          {store.activity.length === 0 ? <p className="note">{t(lang, 'noActivity')}</p> : null}
          <ul className="activity-list" role="list">
            {store.activity.map((item) => {
              const cluster = clusterLabel(lang, item.chain, item.network);
              const where = [chainName(lang, item.chain), cluster].filter(Boolean).join(' ');
              return (
                <li key={item.id} role="listitem">
                  <span>
                    {t(
                      lang,
                      item.method === 'balance'
                        ? 'methodBalance'
                        : item.method === 'sign'
                          ? 'methodSign'
                          : item.method === 'sign_message'
                            ? 'methodSignMessage'
                            : 'methodSend',
                    )}
                    {' · '}
                    {where}
                  </span>
                  <p className="note">
                    {item.detail}
                    {item.hash ? ` ${item.hash.slice(0, 10)}…` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SettingsRow({ icon, label, onOpen }: { icon: SettingsIconName; label: string; onOpen: () => void }) {
  return (
    <button type="button" className="settings-row" onClick={onOpen}>
      <span className="row-label">
        <SettingsGlyph name={icon} />
        {label}
      </span>
      <span className="row-chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
