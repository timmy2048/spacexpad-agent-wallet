import { useState } from 'react';
import { chainName, t } from '../../shared/i18n.ts';
import { truncateAddress } from '../../shared/money.ts';
import { CHAIN_ORDER, type ChainId, type Lang } from '../../shared/types.ts';
import { ChainIcon, CopyIcon } from './icons.tsx';

export function AddressPopover({
  lang,
  username,
  solana,
  evm,
}: {
  lang: Lang;
  username: string;
  solana: string | null;
  evm: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<ChainId | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const copy = async (chain: ChainId, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(chain);
      setNote(null);
      window.setTimeout(() => setCopied((current) => (current === chain ? null : current)), 1200);
    } catch {
      setNote(t(lang, 'couldNotCopy'));
    }
  };

  return (
    <div className="identity" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="identity-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        @{username || 'wallet'}
      </button>
      {open ? (
        <div className="popover" role="dialog" aria-label={t(lang, 'copyAddress')}>
          {CHAIN_ORDER.map((chain) => {
            const address = chain === 'solana' ? solana : evm;
            const kind = chain === 'solana' ? 'solana' : 'evm';
            return (
              <div className="popover-row" key={chain}>
                <ChainIcon chain={chain} />
                <span>{chainName(lang, chain)}</span>
                <span className="addr" title={address ?? ''}>
                  {address ? truncateAddress(address, kind) : '—'}
                </span>
                <button
                  type="button"
                  className="icon-hit"
                  aria-label={t(lang, 'copyAddress')}
                  disabled={!address}
                  onClick={() => {
                    if (address) void copy(chain, address);
                  }}
                >
                  {copied === chain ? <span className="copied">{t(lang, 'copied')}</span> : <CopyIcon />}
                </button>
              </div>
            );
          })}
          {note ? <p className="error popover-note">{note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
