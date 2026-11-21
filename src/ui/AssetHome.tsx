import { useEffect, useRef, useState } from 'react';
import { homeChains, type HomeId } from '../../shared/assets.ts';
import { chainName, t } from '../../shared/i18n.ts';
import { displayAmount, truncateAddress } from '../../shared/money.ts';
import type { Asset, ChainId, Lang, Snapshot } from '../../shared/types.ts';
import { ChevronIcon, CopyIcon, TokenGlyph } from './icons.tsx';

export function AssetHome({
  lang,
  username,
  solana,
  evm,
  snapshots,
  pending,
  walletsReady,
  onRefresh,
  initialHome = 'solana',
  forceOpen = false,
}: {
  lang: Lang;
  username: string;
  solana: string | null;
  evm: string | null;
  snapshots: Snapshot[];
  pending: boolean;
  walletsReady: boolean;
  onRefresh: (() => void) | null;
  initialHome?: HomeId;
  forceOpen?: boolean;
}) {
  const [home, setHome] = useState<HomeId>(initialHome);
  const [open, setOpen] = useState(forceOpen);
  const [copied, setCopied] = useState<HomeId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const next = event.target;
      if (next instanceof Node && rootRef.current?.contains(next)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const addressFor = (id: HomeId) => (id === 'solana' ? solana : evm);
  const copy = async (id: HomeId) => {
    const address = addressFor(id);
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(id);
      setNote(t(lang, 'copied'));
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1400);
    } catch {
      setNote(t(lang, 'couldNotCopy'));
    }
  };

  const chains = homeChains(home, snapshots);
  const waiting = chains.some((chain) => chain.status === 'absent');

  return (
    <section className="home" aria-labelledby="assets-title">
      <h2 id="assets-title" className="who">
        @{username || 'wallet'}
      </h2>
      <div
        className="net"
        ref={rootRef}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !open) return;
          event.stopPropagation();
          setOpen(false);
        }}
      >
        <div className="net-row">
          <button type="button" className="net-main" aria-expanded={open} aria-controls="network-menu" onClick={() => setOpen((value) => !value)}>
            <span className="net-name">{home === 'solana' ? 'Solana' : t(lang, 'evmName')}</span>
            <span className="addr">{addressFor(home) ? truncateAddress(addressFor(home) as string, home === 'solana' ? 'solana' : 'evm') : '—'}</span>
          </button>
          <button
            type="button"
            className={copied === home ? 'icon-hit is-copied' : 'icon-hit'}
            aria-label={`${t(lang, 'copyAddress')} ${home === 'solana' ? 'Solana' : t(lang, 'evmName')}`}
            disabled={!addressFor(home)}
            onClick={() => void copy(home)}
          >
            <CopyIcon />
          </button>
          <button type="button" className="icon-hit" aria-label={t(lang, 'showAddresses')} aria-expanded={open} aria-controls="network-menu" onClick={() => setOpen((value) => !value)}>
            <ChevronIcon up={open} />
          </button>
        </div>
        {open ? (
          <div id="network-menu" className="net-menu" role="listbox" aria-label={t(lang, 'showAddresses')}>
            {(['solana', 'evm'] as const).map((id) => {
              const address = addressFor(id);
              return (
                <div key={id} className={id === home ? 'menu-row is-selected' : 'menu-row'} role="option" aria-selected={id === home}>
                  <button
                    type="button"
                    className="net-main"
                    onClick={() => {
                      setHome(id);
                      setOpen(false);
                    }}
                  >
                    <span className="net-name">{id === 'solana' ? 'Solana' : t(lang, 'evmName')}</span>
                    <span className="addr">{address ? truncateAddress(address, id === 'solana' ? 'solana' : 'evm') : '—'}</span>
                  </button>
                  <button
                    type="button"
                    className={copied === id ? 'icon-hit is-copied' : 'icon-hit'}
                    aria-label={`${t(lang, 'copyAddress')} ${id === 'solana' ? 'Solana' : t(lang, 'evmName')}`}
                    disabled={!address}
                    onClick={() => void copy(id)}
                  >
                    <CopyIcon />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
        <p className="live" aria-live="polite">
          {note ?? ''}
        </p>
      </div>
      {waiting ? <p className="note">{walletsReady || pending ? t(lang, 'readingMainnet') : t(lang, 'walletNotReady')}</p> : null}
      {chains.map((chain) => {
        if (chain.status === 'absent') return null;
        if (chain.status === 'error') {
          return (
            <div className="token token-error" key={chain.chain}>
              <p role="alert">
                {chainName(lang, chain.chain)} {chain.error}
              </p>
              {onRefresh ? (
                <button type="button" className="quiet-button" onClick={onRefresh} disabled={pending}>
                  {t(lang, 'retry')}
                </button>
              ) : null}
            </div>
          );
        }
        return (
          <div key={chain.chain}>
            {chain.assets.map((asset) => (
              <TokenRow key={`${chain.chain}-${asset.native ? 'native' : asset.contract}`} lang={lang} home={home} chain={chain.chain} asset={asset} />
            ))}
            {chain.tokenListError ? (
              <p className="error" role="alert">
                {chain.tokenListError}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function TokenRow({ lang, home, chain, asset }: { lang: Lang; home: HomeId; chain: ChainId; asset: Asset }) {
  return (
    <div className="token">
      <TokenGlyph symbol={asset.symbol} native={asset.native} chain={chain} />
      <span>
        <b>{asset.symbol}</b>
        <small>{subtitle(lang, home, chain, asset)}</small>
      </span>
      <span className="amt">{displayAmount(asset.amount)}</span>
    </div>
  );
}

function subtitle(lang: Lang, home: HomeId, chain: ChainId, asset: Asset): string {
  const where = chainName(lang, chain);
  if (asset.native) return where;
  if (home === 'evm') return asset.name && asset.name !== asset.symbol ? `${asset.name} · ${where}` : where;
  if (asset.contract && asset.name === asset.contract) return where;
  return asset.name || where;
}
