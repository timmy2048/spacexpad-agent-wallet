import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCP_TOOL_NAMES } from '../../shared/prompt.ts';

const TOKEN = 'test-bridge-token';

describe('local MCP client', { timeout: 40_000 }, () => {
  it('discovers the real tools, pairs, and defaults omitted networks to mainnet', async () => {
    const home = await mkdtemp(join(tmpdir(), 'spacexpad-mcp-'));
    const port = 18000 + Math.floor(Math.random() * 20000);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--experimental-strip-types', 'mcp/src/index.ts'],
      cwd: join(import.meta.dirname, '../..'),
      env: {
        PATH: process.env.PATH ?? '',
        HOME: home,
        SPACEXPAD_BRIDGE_PORT: String(port),
        SPACEXPAD_BRIDGE_TOKEN: TOKEN,
      },
      stderr: 'ignore',
    });
    const client = new Client({ name: 'spacexpad-test-client', version: '0.0.0' });
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      const names = listed.tools.map((tool) => tool.name).sort();
      assert.deepEqual(names, [...MCP_TOOL_NAMES].sort());

      const health = await fetch(`http://127.0.0.1:${port}/v1/health`);
      assert.equal(health.status, 200);
      const denied = await post(port, '/v1/wait', {}, false);
      assert.equal(denied.status, 401);

      const unknown = await client.callTool({ name: 'spacexpad_pair', arguments: { pairCode: 'MISSING1', agentName: 'Test' } });
      assert.equal(unknown.isError, true);

      const registered = await post(port, '/v1/pair/register', { pairCode: 'ABCD2345', expiresAt: Date.now() + 60_000 });
      assert.equal(registered.status, 200);
      const paired = await client.callTool({ name: 'spacexpad_pair', arguments: { pairCode: 'ABCD2345', agentName: 'Test agent' } });
      assert.equal(paired.isError, false);
      const issued = JSON.parse(textOf(paired)) as { bindToken: string };
      assert.match(issued.bindToken, /^spx_bind_[a-f0-9]{48}$/);

      const early = await client.callTool({ name: 'spacexpad_get_addresses', arguments: { bindToken: issued.bindToken } });
      assert.equal(early.isError, true);

      const redeemed = await post(port, '/v1/pair/redeem', { pairCode: 'ABCD2345', bindToken: issued.bindToken });
      assert.equal(redeemed.status, 200);

      const absent = await client.callTool({
        name: 'spacexpad_sign_transaction',
        arguments: { bindToken: issued.bindToken, chain: 'base', kind: 'native_transfer', to: '0xabc', amount: '0.01' },
      });
      assert.equal(absent.isError, true);
      assert.match(textOf(absent), /not connected/i);

      const addresses = await roundTrip(client, port, {
        name: 'spacexpad_get_addresses',
        arguments: { bindToken: issued.bindToken },
        reply: { solana: 'SoLanaAddress11111111111111111111111111111', evm: '0x1111111111111111111111111111111111111111' },
      });
      assert.equal(addresses.request.method, 'get_addresses');

      const balance = await roundTrip(client, port, {
        name: 'spacexpad_get_balance',
        arguments: { bindToken: issued.bindToken, chain: 'ethereum' },
        reply: { chain: 'ethereum', network: 'mainnet', assets: [] },
      });
      assert.equal(balance.request.params.network, 'mainnet');

      const badCluster = await client.callTool({
        name: 'spacexpad_get_balance',
        arguments: { bindToken: issued.bindToken, chain: 'solana', network: 'testnet' },
      });
      assert.equal(badCluster.isError, true);
      assert.match(textOf(badCluster), /devnet/);

      const mainnetSign = await roundTrip(client, port, {
        name: 'spacexpad_sign_transaction',
        arguments: { bindToken: issued.bindToken, chain: 'base', kind: 'native_transfer', to: '0xabc', amount: '0.01' },
        replyError: 'Test harness did not sign.',
      });
      assert.equal(mainnetSign.request.method, 'sign');
      assert.equal(mainnetSign.request.params.network, 'mainnet');
      assert.match(textOf(mainnetSign.result), /did not sign/);

      const testnetSign = await roundTrip(client, port, {
        name: 'spacexpad_send_transaction',
        arguments: {
          bindToken: issued.bindToken,
          chain: 'base',
          network: 'testnet',
          kind: 'native_transfer',
          to: '0xabc',
          amount: '0.01',
        },
        replyError: 'Test harness did not sign.',
      });
      assert.equal(testnetSign.request.params.network, 'testnet');
      assert.notEqual(testnetSign.request.params.network, 'mainnet');
    } finally {
      await client.close();
      await rm(home, { recursive: true, force: true });
    }
  });
});

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content;
  const block = content?.find((item) => item.type === 'text');
  return block?.text ?? '';
}

async function post(port: number, path: string, body: unknown, auth = true): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) headers.authorization = `Bearer ${TOKEN}`;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  return { status: response.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

async function roundTrip(
  client: Client,
  port: number,
  input: { name: string; arguments: Record<string, unknown>; reply?: unknown; replyError?: string },
) {
  const pending = post(port, '/v1/wait', {});
  await delay(150);
  const call = client.callTool({ name: input.name, arguments: input.arguments });
  const waited = await pending;
  const request = waited.json.request as { id: string; method: string; params: { network?: string } };
  assert.ok(request?.id, 'extension did not receive a request');
  const resultBody = input.replyError
    ? { id: request.id, ok: false, error: input.replyError }
    : { id: request.id, ok: true, result: input.reply };
  await post(port, '/v1/result', resultBody);
  const result = await call;
  return { request, result };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
