import type { Lang } from '../../shared/types.ts';
import { t } from '../../shared/i18n.ts';
import { brandIcon } from './brand.ts';
import { GoogleIcon } from './icons.tsx';

export type OtpPhase = 'idle' | 'sending' | 'sent' | 'confirming';

export function LoginScreen({
  lang,
  email,
  code,
  phase,
  notice,
  error,
  onEmail,
  onCode,
  onSend,
  onConfirm,
  onGoogle,
}: {
  lang: Lang;
  email: string;
  code: string;
  phase: OtpPhase;
  notice: string | null;
  error: string | null;
  onEmail: (value: string) => void;
  onCode: (value: string) => void;
  onSend: () => void;
  onConfirm: () => void;
  onGoogle: () => void;
}) {
  const sending = phase === 'sending';
  const confirming = phase === 'confirming';
  const sent = phase === 'sent' || phase === 'confirming';
  return (
    <main className="shell login-shell">
      <h1 className="wordmark">{t(lang, 'appName')}</h1>
      <div className="login-hero">
        <img src={brandIcon(128)} alt="" />
      </div>
      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (sent) onConfirm();
          else onSend();
        }}
      >
        <label className="field" htmlFor="login-email">
          <span>{t(lang, 'email')}</span>
          <input
            id="login-email"
            type="email"
            value={email}
            placeholder="you@email.com"
            autoComplete="email"
            inputMode="email"
            onChange={(event) => onEmail(event.target.value)}
          />
        </label>
        {sent ? null : (
          <button type="submit" className="primary" disabled={sending}>
            {sending ? t(lang, 'sendingCode') : t(lang, 'sendCode')}
          </button>
        )}
        {sent ? (
          <>
            <label className="field" htmlFor="login-code">
              <span>{t(lang, 'code')}</span>
              <input
                id="login-code"
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                onChange={(event) => onCode(event.target.value)}
              />
            </label>
            <button type="submit" className="primary" disabled={confirming || code.trim().length < 4}>
              {confirming ? t(lang, 'working') : t(lang, 'confirmCode')}
            </button>
            <button type="button" className="quiet-button" disabled={sending} onClick={onSend}>
              {sending ? t(lang, 'sendingCode') : t(lang, 'sendCode')}
            </button>
          </>
        ) : null}
        <p className="live" aria-live="polite">
          {notice ?? ''}
        </p>
        {notice ? <p className="note">{notice}</p> : null}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="or" role="separator">
          <span />
          <span>{t(lang, 'or')}</span>
          <span />
        </div>
        <button type="button" className="google" onClick={onGoogle}>
          <GoogleIcon />
          {t(lang, 'continueGmail')}
        </button>
      </form>
    </main>
  );
}
