import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolveCluster } from '../../shared/chains.ts';
import type { AgentResult, ChainId } from '../../shared/types.ts';
import { createBridge, txParams, type Bridge } from './bridge.ts';

const PORT = Number(process.env.SPACEXPAD_BRIDGE_PORT || 47321);
const DIR = join(homedir(), '.spacexpad-agent-wallet');
const FILE = join(DIR, 'bridge.json');

type Disk = { token: string; pairs: ReturnType<Bridge['exportPairs']> };

const bridge = createBridge();
const state: { token: string } = { token: '' };

async function loadDisk(): Promise<void> {
  await mkdir(DIR, { recursive: true });
  let disk: Disk | null = null;
  try {
    disk = JSON.parse(await readFile(FILE, 'utf8')) as Disk;
  } catch {
    disk = null;
  }
  state.token = process.env.SPACEXPAD_BRIDGE_TOKEN || disk?.token || randomBytes(24).toString('hex');
  if (disk?.pairs) bridge.importPairs(disk.pairs);
  await saveDisk();
}

async function saveDisk(): Promise<void> {
  const disk: Disk = { token: state.token, pairs: bridge.exportPairs() };
  await writeFile(FILE, JSON.stringify(disk, null, 2));
}

function authorized(req: IncomingMessage): boolean {
  const header = req.headers.authorization ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  const left = Buffer.from(presented);
  const right = Buffer.from(state.token);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function loopback(req: IncomingMessage): boolean {
  const host = req.headers.host ?? '';
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host);
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!loopback(req)) {
    send(res, 403, { error: 'The bridge accepts loopback clients only.' });
    return;
  }
  const url = req.url ?? '/';
  if (req.method === 'GET' && url === '/v1/health') {
    send(res, 200, { ok: true });
    return;
  }
  if (req.method === 'GET' && url === '/v1/bootstrap') {
    send(res, 200, { token: state.token });
    return;
  }
  if (!authorized(req)) {
    send(res, 401, { error: 'Bridge token was rejected.' });
    return;
  }
  const body = req.method === 'POST' ? await readJson(req) : {};
  if (req.method === 'POST' && url === '/v1/wait') {
    const request = await bridge.waitForRequest();
    send(res, 200, { request });
    return;
  }
  if (req.method === 'POST' && url === '/v1/result') {
    const result: AgentResult = body.ok
      ? { ok: true, result: body.result }
      : { ok: false, error: String(body.error ?? 'Request failed.'), code: body.code as AgentResult extends { code?: infer C } ? C : never };
    const accepted = bridge.finish(String(body.id ?? ''), result.ok ? result : { ok: false, error: result.error, code: result.code });
    send(res, accepted ? 200 : 404, { ok: accepted });
    return;
  }
  if (req.method === 'POST' && url === '/v1/confirm') {
    send(res, 200, bridge.confirm(String(body.id ?? '')));
    return;
  }
  if (req.method === 'POST' && url === '/v1/pair/register') {
    bridge.registerPair(String(body.pairCode ?? ''), Number(body.expiresAt));
    await saveDisk();
    send(res, 200, { ok: true });
    return;
  }
  if (req.method === 'POST' && url === '/v1/pair/redeem') {
    try {
      const redeemed = bridge.redeem(String(body.pairCode ?? ''), String(body.bindToken ?? ''));
      await saveDisk();
      send(res, 200, redeemed);
    } catch (error) {
      send(res, 400, { error: error instanceof Error ? error.message : 'Could not bind.' });
    }
    return;
  }
  if (req.method === 'POST' && url === '/v1/pair/unbind') {
    bridge.unbind(String(body.bindToken ?? ''));
    await saveDisk();
    send(res, 200, { ok: true });
    return;
  }
  send(res, 404, { error: 'Not found.' });
}

function toolText(value: unknown, isError = false) {
  return {
    isError,
    content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  };
}

function requireRedeemed(bindToken: string): string | null {
  if (!bridge.isRedeemed(bindToken)) {
    return 'This binding token is not recognized. Paste it into SpaceXpad first.';
  }
  return null;
}

const chainSchema = z.enum(['solana', 'ethereum', 'base', 'bnb']);
const networkSchema = z
  .enum(['mainnet', 'testnet', 'devnet'])
  .optional()
  .describe('Omit to use mainnet. Pass testnet or devnet only when the user explicitly asked. Solana test traffic is devnet.');

function networkOrError(chain: ChainId, network: string | undefined): string | null {
  try {
    resolveCluster(chain, network);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Unsupported network.';
  }
}

function chosenNetwork(chain: ChainId, network: string | undefined): 'mainnet' | 'testnet' | 'devnet' {
  return resolveCluster(chain, network).network;
}

async function main(): Promise<void> {
  await loadDisk();
  const server = createServer((req, res) => {
    void (async () => {
      try {
        await route(req, res);
      } catch (error) {
        send(res, 500, { error: error instanceof Error ? error.message : 'Bridge error.' });
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve());
  });
  console.error('SpaceXpad agent bridge');
  console.error(`Listening on http://127.0.0.1:${PORT}`);
  console.error(`Bridge token: ${state.token}`);
  console.error(`Saved at ${FILE}`);

  const mcp = new McpServer({ name: 'spacexpad-agent-wallet', version: '0.1.0' });
  mcp.registerTool(
    'spacexpad_pair',
    {
      description:
        'Complete pairing with a PAIR_CODE from the SpaceXpad extension. Returns an spx_bind_ token the user pastes into the extension bind screen. Do not ask them to paste a bridge token into Settings. Later calls use mainnet unless testnet or devnet is explicit.',
      inputSchema: { pairCode: z.string(), agentName: z.string() },
    },
    async ({ pairCode, agentName }) => {
      try {
        const issued = await bridge.issueWhenRegistered(pairCode, agentName);
        await saveDisk();
        return toolText({
          ...issued,
          message:
            'Show this binding token to the user and ask them to paste it into the SpaceXpad bind screen. Do not ask them to paste a bridge token into Settings. Do not call other wallet tools until the bind succeeds.',
        });
      } catch (error) {
        return toolText(error instanceof Error ? error.message : 'Pairing failed.', true);
      }
    },
  );
  mcp.registerTool(
    'spacexpad_get_addresses',
    {
      description:
        'Read the Solana address and the shared EVM address. This does not select a network. Ethereum, Base, and BNB Chain share the EVM address.',
      inputSchema: { bindToken: z.string() },
    },
    async ({ bindToken }) => {
      const denied = requireRedeemed(bindToken);
      if (denied) return toolText(denied, true);
      const result = await bridge.request({ id: randomBytes(8).toString('hex'), method: 'get_addresses', params: { bindToken } });
      return toolText(result.ok ? result.result : result.error, !result.ok);
    },
  );
  mcp.registerTool(
    'spacexpad_get_balance',
    {
      description:
        'Read the native balance and other fungible tokens. chain is required. network defaults to mainnet. Pass testnet or devnet only when the user explicitly asked. Solana test traffic is devnet, not testnet.',
      inputSchema: { bindToken: z.string(), chain: chainSchema, network: networkSchema },
    },
    async ({ bindToken, chain, network }) => {
      const denied = requireRedeemed(bindToken);
      if (denied) return toolText(denied, true);
      const invalid = networkOrError(chain, network);
      if (invalid) return toolText(invalid, true);
      const result = await bridge.request({
        id: randomBytes(8).toString('hex'),
        method: 'get_balance',
        params: { bindToken, chain: chain as ChainId, network: chosenNetwork(chain, network) },
      });
      return toolText(result.ok ? result.result : result.error, !result.ok);
    },
  );
  const txShape = {
    bindToken: z.string(),
    chain: chainSchema,
    network: networkSchema,
    kind: z.enum(['native_transfer', 'serialized']),
    to: z.string().optional(),
    amount: z.string().optional().describe('Human amount for a native transfer, such as 0.01'),
    serialized: z.string().optional().describe('Hex or base64 serialized transaction'),
  };
  mcp.registerTool(
    'spacexpad_sign_transaction',
    {
      description:
        'Ask the wallet to sign a transaction and return the signed bytes. Does not broadcast. chain is required. network defaults to mainnet. An explicit testnet or devnet waits for confirmation in the extension. The extension enforces the risk policy and kill switch. Do not claim success without a signedTransaction in the result.',
      inputSchema: txShape,
    },
    async (args) => answerTx('sign', args),
  );
  mcp.registerTool(
    'spacexpad_sign_message',
    {
      description:
        'Ask the wallet to sign an arbitrary message with the bound Solana wallet. chain must be solana. network defaults to mainnet; Solana test traffic is devnet, and solana testnet is rejected. encoding defaults to utf8 and signs those exact UTF-8 bytes with no prefix. Pass hex or base64 only when the message is not text. Every message, including mainnet, waits for confirmation in the extension. The result signature is base64, which is what POST /api/agent/verify expects in the signature field. signatureBase58 is the same bytes. Do not claim a signature that is not in the result.',
      inputSchema: {
        bindToken: z.string(),
        chain: chainSchema,
        network: networkSchema,
        message: z.string().describe('UTF-8 text by default. Hex or base64 only when encoding says so.'),
        encoding: z
          .enum(['utf8', 'hex', 'base64'])
          .optional()
          .describe('Omit or pass utf8 to sign the exact UTF-8 bytes. hex may include a 0x prefix. base64 is standard base64.'),
      },
    },
    async ({ bindToken, chain, network, message, encoding }) => {
      const denied = requireRedeemed(bindToken);
      if (denied) return toolText(denied, true);
      if (chain !== 'solana') return toolText('Message signing currently supports Solana only. Pass chain "solana".', true);
      const invalid = networkOrError(chain, network);
      if (invalid) return toolText(invalid, true);
      const result = await bridge.request({
        id: randomBytes(8).toString('hex'),
        method: 'sign_message',
        params: {
          bindToken,
          chain,
          network: chosenNetwork(chain, network),
          message,
          encoding: encoding ?? 'utf8',
        },
      });
      return toolText(result.ok ? result.result : result.error, !result.ok);
    },
  );
  mcp.registerTool(
    'spacexpad_send_transaction',
    {
      description:
        'Ask the wallet to sign and submit a transaction. chain is required. network defaults to mainnet. An explicit testnet or devnet waits for confirmation in the extension. Returns a hash only if the RPC accepted it. The extension enforces the risk policy and kill switch. Never invent a transaction hash.',
      inputSchema: txShape,
    },
    async (args) => answerTx('send', args),
  );

  await mcp.connect(new StdioServerTransport());
}

async function answerTx(
  method: 'sign' | 'send',
  args: { bindToken: string; chain: ChainId; network?: 'mainnet' | 'testnet' | 'devnet'; kind: 'native_transfer' | 'serialized'; to?: string; amount?: string; serialized?: string },
) {
  const denied = requireRedeemed(args.bindToken);
  if (denied) return toolText(denied, true);
  const invalid = networkOrError(args.chain, args.network);
  if (invalid) return toolText(invalid, true);
  const result = await bridge.request(txParams(method, { ...args, network: chosenNetwork(args.chain, args.network) }));
  return toolText(result.ok ? result.result : result.error, !result.ok);
}

await main();
