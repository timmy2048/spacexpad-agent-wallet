import { useEffect, useRef, useState } from 'react';
import { chainName, t } from '../../shared/i18n.ts';
import { truncateAddress } from '../../shared/money.ts';
import { CHAIN_ORDER, type ChainId, type Lang } from '../../shared/types.ts';
import { ChainIcon, CopyIcon } from './icons.tsx';

export function AddressPopover({
  lang,
  username,
  solana,
  evm,
  forceOpen = false,
}: {
  lang: Lang;
  username: string;
  solana: string | null;
  evm: string | null;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(forceOpen);
  const [copied, setCopied] = useState<ChainId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const cancelClose = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const openNow = () => {
    cancelClose();
    setOpen(true);
  };

  const closeSoon = () => {
    if (forceOpen) return;
    cancelClose();
    timer.current = window.setTimeout(() => setOpen(false), 160);
  };

  const copy = async (chain: ChainId, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(chain);
      setNote(null);
      window.setTimeout(() => setCopied((current) => (current === chain ? null : current)), 1400);
    } catch {
      setNote(t(lang, 'couldNotCopy'));
    }
  };

  return (
    <div
      className="identity"
      ref={rootRef}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && rootRef.current?.contains(next)) return;
        closeSoon();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="identity-trigger"
        aria-expanded={open}
        aria-controls="address-list"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="at" aria-hidden="true">
          @
        </span>
        {username || 'wallet'}
      </button>
      {open ? (
        <div id="address-list" className="popover" role="region" aria-label={t(lang, 'showAddresses')}>
          <ul className="address-list" role="list">
            {CHAIN_ORDER.map((chain) => {
              const address = chain === 'solana' ? solana : evm;
              const kind = chain === 'solana' ? 'solana' : 'evm';
              return (
                <li className="popover-row" key={chain} role="listitem">
                  <ChainIcon chain={chain} />
                  <span>{chainName(lang, chain)}</span>
                  <span className="addr">{address ? truncateAddress(address, kind) : '—'}</span>
                  <button
                    type="button"
                    className="icon-hit"
                    aria-label={`${t(lang, 'copyAddress')} ${chainName(lang, chain)}`}
                    disabled={!address}
                    onClick={() => {
                      if (address) void copy(chain, address);
                    }}
                  >
                    {copied === chain ? <span className="copied">{t(lang, 'copied')}</span> : <CopyIcon />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="live" aria-live="polite">
            {note ?? (copied ? t(lang, 'copied') : '')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
