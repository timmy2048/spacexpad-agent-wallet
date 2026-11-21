import { useId } from 'react';
import type { ChainId } from '../../shared/types.ts';

export function SolanaLogo() {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="glyph" viewBox="0 0 36 36" aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="#14182b" />
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#9945FF" />
          <stop offset="0.5" stopColor="#14F195" />
          <stop offset="1" stopColor="#00D1FF" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id}a)`}>
        <polygon points="10.2,9.2 27.6,9.2 25.2,12.4 7.8,12.4" />
        <polygon points="7.8,16.2 25.2,16.2 27.6,19.4 10.2,19.4" />
        <polygon points="10.2,23.2 27.6,23.2 25.2,26.4 7.8,26.4" />
      </g>
    </svg>
  );
}

export function EvmLogo() {
  return (
    <svg className="glyph" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#2563EB" />
      <path d="M18 8.5 L26.5 19.2 H21.2 V27.5 H14.8 V19.2 H9.5 Z" fill="#F8FAFC" />
    </svg>
  );
}

export function NetworkGlyph({ home }: { home: 'solana' | 'evm' }) {
  return home === 'solana' ? <SolanaLogo /> : <EvmLogo />;
}

export function TokenGlyph({ symbol, native, chain }: { symbol: string; native: boolean; chain: ChainId }) {
  const key = symbol.toUpperCase();
  if (native && chain === 'solana') return <SolanaLogo />;
  if (key === 'SOL') return <SolanaLogo />;
  if (key === 'USDC') return <UsdcLogo />;
  if (key === 'USDT') return <UsdtLogo />;
  if (native && chain === 'bnb') return <BnbLogo />;
  if (key === 'BNB') return <BnbLogo />;
  if (native && (chain === 'ethereum' || chain === 'base')) return <EthLogo />;
  if (key === 'ETH') return <EthLogo />;
  return <LetterLogo letter={symbol.slice(0, 1).toUpperCase() || '?'} />;
}

function UsdcLogo() {
  return (
    <svg className="glyph" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#2775CA" />
      <text x="18" y="23.5" textAnchor="middle" fontSize="18" fontFamily="Sora, sans-serif" fontWeight="700" fill="#fff">
        $
      </text>
    </svg>
  );
}

function UsdtLogo() {
  return (
    <svg className="glyph" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#26A17B" />
      <text x="18" y="23.5" textAnchor="middle" fontSize="16" fontFamily="Sora, sans-serif" fontWeight="700" fill="#fff">
        ₮
      </text>
    </svg>
  );
}

function EthLogo() {
  return (
    <svg className="glyph" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#627EEA" />
      <path d="M18 7 L26.2 18.1 L18 21.6 L9.8 18.1 Z" fill="#fff" opacity="0.85" />
      <path d="M18 23.2 L26.2 19.6 L18 29.2 L9.8 19.6 Z" fill="#fff" />
    </svg>
  );
}

function BnbLogo() {
  return (
    <svg className="glyph" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#F3BA2F" />
      <path d="M18 8.2 L21.2 11.4 L18 14.6 L14.8 11.4 Z M11.2 15 L14.4 18.2 L11.2 21.4 L8 18.2 Z M24.8 15 L28 18.2 L24.8 21.4 L21.6 18.2 Z M18 21.4 L21.2 24.6 L18 27.8 L14.8 24.6 Z M18 15.4 L21.2 18.6 L18 21.8 L14.8 18.6 Z" fill="#14182b" />
    </svg>
  );
}

function LetterLogo({ letter }: { letter: string }) {
  return (
    <svg className="glyph" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#243056" />
      <text x="18" y="23" textAnchor="middle" fontSize="14" fontFamily="Sora, sans-serif" fontWeight="600" fill="#F1F5F9">
        {letter}
      </text>
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg className="mini" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="6" y="5" width="7" height="8" rx="1.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 10.2 V3.6 Q4 2.6 5 2.6 H10.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg className={up ? 'mini chev up' : 'mini chev'} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 6.2 L8 10.4 L12.5 6.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
