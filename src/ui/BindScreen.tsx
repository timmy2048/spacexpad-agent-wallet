import type { ReactNode } from 'react';
import { t } from '../../shared/i18n.ts';
import type { Lang } from '../../shared/types.ts';

export function BindScreen({
  lang,
  token,
  copied,
  error,
  onToken,
  onCopy,
  onBind,
  onLanguage,
  onLogout,
}: {
  lang: Lang;
  token: string;
  copied: boolean;
  error: string | null;
  onToken: (value: string) => void;
  onCopy: () => void;
  onBind: () => void;
  onLanguage: (lang: Lang) => void;
  onLogout: () => void;
}) {
  return (
    <section className="gate" aria-labelledby="bind-title">
      <h2 id="bind-title">{t(lang, 'bindTitle')}</h2>
      <p className="lead">{t(lang, 'bindLead')}</p>
      <p className="note">{t(lang, 'bindIntro')}</p>
      <button type="button" className="primary" onClick={onCopy}>
        {copied ? t(lang, 'promptCopied') : t(lang, 'copyPrompt')}
      </button>
      <label className="field" htmlFor="bind-token">
        <span>{t(lang, 'tokenLabel')}</span>
        <input
          id="bind-token"
          value={token}
          onChange={(event) => onToken(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button type="button" className="primary" onClick={onBind}>
        {t(lang, 'bindAction')}
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="label">{t(lang, 'language')}</p>
      <LanguageChoices lang={lang} onLanguage={onLanguage} />
      <button type="button" className="quiet-button logout" onClick={onLogout}>
        {t(lang, 'logout')}
      </button>
    </section>
  );
}

export function LanguageChoices({ lang, onLanguage }: { lang: Lang; onLanguage: (lang: Lang) => void }) {
  return (
    <div className="choices" role="group" aria-label={t(lang, 'language')}>
      {(['zh-CN', 'zh-TW', 'en'] as Lang[]).map((item) => (
        <button key={item} type="button" aria-pressed={lang === item} onClick={() => onLanguage(item)}>
          {item === 'en' ? 'English' : item === 'zh-CN' ? '简体中文' : '繁體中文'}
        </button>
      ))}
    </div>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return <div className="banner">{children}</div>;
}
