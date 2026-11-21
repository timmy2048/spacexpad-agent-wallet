#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(
    [
      'SpaceXpad agent wallet local MCP server',
      '',
      'Speaks MCP on stdin/stdout and listens on 127.0.0.1:47321.',
      'There is no hosted endpoint.',
      '',
      'From the repository:',
      '  node --experimental-strip-types mcp/src/index.ts',
      '',
      'Omit network on wallet tools to use mainnet.',
      'Pass testnet or devnet only when the user explicitly asked.',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

const child = spawn(process.execPath, ['--experimental-strip-types', entry], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
