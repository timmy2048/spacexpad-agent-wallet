import type { ChainId } from '../../shared/types.ts';

export function ChainIcon({ chain }: { chain: ChainId }) {
  return (
    <svg className="chain-icon" viewBox="0 0 16 16" aria-hidden="true">
      {chain === 'solana' ? <SolanaMark /> : null}
      {chain === 'ethereum' ? <EthereumMark /> : null}
      {chain === 'base' ? <BaseMark /> : null}
      {chain === 'bnb' ? <BnbMark /> : null}
    </svg>
  );
}

function SolanaMark() {
  return (
    <g fill="currentColor">
      <polygon points="2,3.2 13,3.2 11.2,5.2 0.2,5.2" />
      <polygon points="0.2,6.8 11.2,6.8 13,8.8 2,8.8" />
      <polygon points="2,10.4 13,10.4 11.2,12.4 0.2,12.4" />
    </g>
  );
}

function EthereumMark() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.2">
      <polygon points="8,1.2 13.2,8 8,14.8 2.8,8" />
      <path d="M2.8 8 H13.2" />
    </g>
  );
}

function BaseMark() {
  return <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.3" />;
}

function BnbMark() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.2">
      <polygon points="8,1.4 14.2,8 8,14.6 1.8,8" />
      <polygon points="8,4.2 11.4,8 8,11.8 4.6,8" />
    </g>
  );
}

export function CopyIcon() {
  return (
    <svg className="copy-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5" y="3" width="8" height="10" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 11 V3 H9" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
