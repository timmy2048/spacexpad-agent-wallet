import { formatUsd, usdToMicro, utcDate } from './money.ts';
import type { Denial, RiskPolicy } from './types.ts';

export type PolicyFacts = {
  policy: RiskPolicy;
  spent: { date: string; microUsd: string };
  now: number;
  transferMicroUsd: bigint | null;
  destinations: string[] | null;
};

export function evaluatePolicy(facts: PolicyFacts): { allow: true } | ({ allow: false } & Denial) {
  const { policy } = facts;
  if (policy.agentsPaused) return { allow: false, code: 'paused' };

  if (policy.whitelistEnabled) {
    if (policy.whitelist.length === 0) return { allow: false, code: 'whitelist-empty' };
    if (!facts.destinations) return { allow: false, code: 'whitelist-unknown' };
    for (const destination of facts.destinations) {
      const listed = policy.whitelist.some((entry) => same(entry.address, destination));
      if (!listed) return { allow: false, code: 'whitelist-miss', address: destination };
    }
  }

  if (policy.fullAccess) return { allow: true };

  if (policy.singleTxUsd === null && policy.dailyUsd === null) {
    return { allow: false, code: 'limits-unset' };
  }
  if (facts.transferMicroUsd === null) return { allow: false, code: 'unpriced' };

  const transfer = facts.transferMicroUsd;
  if (policy.singleTxUsd !== null) {
    const limit = usdToMicro(policy.singleTxUsd);
    if (transfer > limit) {
      return { allow: false, code: 'single-limit', usd: formatUsd(transfer), limit: formatUsd(limit) };
    }
  }
  if (policy.dailyUsd !== null) {
    const limit = usdToMicro(policy.dailyUsd);
    const spent = facts.spent.date === utcDate(facts.now) ? BigInt(facts.spent.microUsd || '0') : 0n;
    if (spent + transfer > limit) {
      return {
        allow: false,
        code: 'daily-limit',
        usd: formatUsd(transfer),
        spent: formatUsd(spent),
        limit: formatUsd(limit),
      };
    }
  }
  return { allow: true };
}

function same(left: string, right: string): boolean {
  if (left.startsWith('0x') || left.startsWith('0X') || right.startsWith('0x') || right.startsWith('0X')) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}
