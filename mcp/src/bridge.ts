import { randomBytes } from 'node:crypto';
import type { AgentResult, ChainId, Inbound, TxParams } from '../../shared/types.ts';

export type PairRecord = {
  code: string;
  expiresAt: number;
  bindToken?: string;
  agentId?: string;
  agentName?: string;
  redeemed?: boolean;
};

type Job = {
  inbound: Inbound;
  delivered: boolean;
  cancelled: boolean;
  confirmed: boolean;
  done: boolean;
  resolve: (result: AgentResult) => void;
};

export function createBridge() {
  const pairs = new Map<string, PairRecord>();
  const jobs: Job[] = [];
  let waiter: ((job: Job | null) => void) | null = null;
  let activeWaiters = 0;
  let lastSeen = 0;

  function connected(): boolean {
    return activeWaiters > 0 || (lastSeen > 0 && Date.now() - lastSeen < 5000);
  }

  function registerPair(code: string, expiresAt: number): void {
    const existing = pairs.get(code);
    if (existing?.bindToken) return;
    pairs.set(code, { code, expiresAt });
  }

  function issue(code: string, agentName: string): { bindToken: string; agentId: string; agentName: string } {
    const pair = pairs.get(code);
    if (!pair || pair.expiresAt < Date.now()) throw new Error('That pairing code is unknown or expired.');
    if (pair.bindToken && pair.agentId && pair.agentName) {
      return { bindToken: pair.bindToken, agentId: pair.agentId, agentName: pair.agentName };
    }
    const name = agentName.replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 40) || 'Agent';
    pair.bindToken = `spx_bind_${randomBytes(24).toString('hex')}`;
    pair.agentId = `agent_${randomBytes(4).toString('hex')}`;
    pair.agentName = name;
    return { bindToken: pair.bindToken, agentId: pair.agentId, agentName: name };
  }

  function redeem(code: string, bindToken: string): { agentId: string; agentName: string } {
    const pair = pairs.get(code);
    if (!pair || pair.expiresAt < Date.now()) throw new Error('That pairing code expired. Copy a new prompt.');
    if (!pair.bindToken || pair.bindToken !== bindToken || !pair.agentId || !pair.agentName) {
      throw new Error('That token was not recognized.');
    }
    pair.redeemed = true;
    return { agentId: pair.agentId, agentName: pair.agentName };
  }

  function unbind(bindToken: string): void {
    for (const pair of pairs.values()) {
      if (pair.bindToken === bindToken) pair.redeemed = false;
    }
  }

  function isRedeemed(bindToken: string): boolean {
    for (const pair of pairs.values()) {
      if (pair.bindToken === bindToken && pair.redeemed) return true;
    }
    return false;
  }

  async function request(inbound: Inbound): Promise<AgentResult> {
    if (!connected()) {
      return {
        ok: false,
        error:
          'SpaceXpad extension is not connected. Open Chrome with the extension loaded and signed in. The extension connects to this local bridge on its own.',
      };
    }
    if (inbound.method !== 'get_addresses' && !isRedeemed(inbound.params.bindToken)) {
      return { ok: false, error: 'This binding token is not recognized. Paste it into the SpaceXpad bind screen first.' };
    }
    let resolveJob: (result: AgentResult) => void = () => undefined;
    const promise = new Promise<AgentResult>((resolve) => {
      resolveJob = resolve;
    });
    const job: Job = {
      inbound,
      delivered: false,
      cancelled: false,
      confirmed: false,
      done: false,
      resolve: (result) => {
        job.done = true;
        resolveJob(result);
      },
    };
    jobs.push(job);
    if (waiter) {
      job.delivered = true;
      const current = waiter;
      waiter = null;
      current(job);
    }
    return Promise.race([promise, timedOut(job)]);
  }

  async function waitForRequest(): Promise<Inbound | null> {
    activeWaiters += 1;
    lastSeen = Date.now();
    try {
      const pending = jobs.find((job) => !job.delivered && !job.cancelled && !job.done);
      if (pending) {
        pending.delivered = true;
        return pending.inbound;
      }
      return await new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiter = null;
          resolve(null);
        }, 20000);
        waiter = (job) => {
          clearTimeout(timer);
          resolve(job ? job.inbound : null);
        };
      });
    } finally {
      activeWaiters -= 1;
      lastSeen = Date.now();
    }
  }

  function confirm(id: string): { proceed: boolean } {
    const job = jobs.find((item) => item.inbound.id === id);
    if (!job || job.cancelled || job.done) return { proceed: false };
    job.confirmed = true;
    return { proceed: true };
  }

  function finish(id: string, result: AgentResult): boolean {
    const job = jobs.find((item) => item.inbound.id === id);
    if (!job || job.done) return false;
    job.resolve(result);
    return true;
  }

  function exportPairs(): PairRecord[] {
    return [...pairs.values()];
  }

  function importPairs(records: PairRecord[]): void {
    for (const record of records) pairs.set(record.code, record);
  }

  return {
    connected,
    registerPair,
    issue,
    redeem,
    unbind,
    isRedeemed,
    request,
    waitForRequest,
    confirm,
    finish,
    exportPairs,
    importPairs,
  };
}

export type Bridge = ReturnType<typeof createBridge>;

function timedOut(job: Job): Promise<AgentResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (job.done) return;
      if (!job.confirmed) {
        job.cancelled = true;
        resolve({ ok: false, error: 'The extension did not answer in time. Nothing was signed.' });
        return;
      }
      resolve({
        ok: false,
        error: 'Signing started but did not finish in time. Check recent activity in SpaceXpad before trying again.',
      });
    }, 90_000);
  });
}

export function balanceParams(bindToken: string, chain: ChainId, network: string): Inbound {
  return { id: randomBytes(8).toString('hex'), method: 'get_balance', params: { bindToken, chain, network } };
}

export function txParams(method: 'sign' | 'send', params: TxParams): Inbound {
  return { id: randomBytes(8).toString('hex'), method, params };
}
