# SpaceXpad local MCP

The launchpad is [https://spacexpad.xyz/](https://spacexpad.xyz/). Checked on 21 November 2026, without changing the site:

| Path | Result | Belongs to |
| --- | --- | --- |
| `/` | 200, launch prompts | launchpad |
| `/skill`, `/skill.md` | 200, Solana fair-mint skill | launchpad |
| `/agents` | 200, “How agents participate” | launchpad |
| `/prompt`, `/prompts`, `/docs`, `/faq` | 404, still not used for this wallet | leave empty |
| `/wallet`, `/wallet/` | 404 | left unused; the homepage already says “agent wallet” |
| `/agent-wallet`, `/agent-wallet/` | 404 | not the document |
| `/agent-wallet/skill.md` | 404 | reserved document for this extension |

The reserved public document is `https://spacexpad.xyz/agent-wallet/skill.md`. It is not published, and it is not `/skill` or `/skill.md`. Do not write this extension's setup onto `/`, `/skill`, `/skill.md`, `/agents`, `/prompt`, or `/docs`. Publishing that new file is a later site change, not part of this repo. Until it exists, the runnable server is the local process below. Do not put a pair code or bridge token in the public URL.

The agent bridge is a process you run on the same computer as Chrome. It is not a hosted service. Do not point a client at a public URL. Do not put the bridge token or a pair code in a public page. The pair code is only inside the prompt the extension copies after the user asks for it.

## What it does

`mcp/src/index.ts` is both the MCP server and the loopback bridge.

- MCP uses stdin and stdout. Configure the client to spawn the process. Do not wrap it in a shell that swallows stdio.
- HTTP listens on `127.0.0.1:47321` (override with `SPACEXPAD_BRIDGE_PORT`).
- Requests must use a `Host` of `127.0.0.1` or `localhost`.
- Every route except `GET /v1/health` requires `Authorization: Bearer <bridge token>`.
- The token is random, printed on stderr, and stored in `~/.spacexpad-agent-wallet/bridge.json`. Set `SPACEXPAD_BRIDGE_TOKEN` to pin one. Do not commit it. The extension stores the same token in `chrome.storage.local` after you paste it into Settings.

The Chrome extension polls `POST /v1/wait` from the offscreen document. Tool calls wait until that poll is active. If the extension is closed or the token does not match, the tool returns an error and nothing is signed.

## Prerequisites

- Node.js 22 or newer (`--experimental-strip-types`)
- This repository checked out
- `npm install`
- `npm run build` for the extension itself
- Chrome with the unpacked `dist` loaded, the public Privy app id from `config.example.json`, and the bridge token saved in Settings

There is no App Secret in this repository. Do not add one.

## Run

```bash
node --experimental-strip-types mcp/src/index.ts
```

`npm run mcp` is the same command. `node mcp/bin/spacexpad-agent-wallet.mjs --help` prints the short usage text. `npm exec spacexpad-agent-wallet` works only inside this repo. The package is private and is not published to npm.

## Client configuration

Cursor or Claude Desktop:

```json
{
  "mcpServers": {
    "spacexpad-agent-wallet": {
      "command": "node",
      "args": ["--experimental-strip-types", "mcp/src/index.ts"],
      "cwd": "<absolute path to this repository>"
    }
  }
}
```

Replace the `cwd` with the real absolute path. After the client connects, tool discovery returns exactly:

- `spacexpad_pair`
- `spacexpad_get_addresses`
- `spacexpad_get_balance`
- `spacexpad_sign_transaction`
- `spacexpad_send_transaction`

The copied pair prompt in the extension repeats this configuration. Pairing is a one-time code that expires in 10 minutes. The user pastes the `spx_bind_` token back into the extension. Removing the agent revokes that binding.

## Networks

Omit `network` and the call uses mainnet. Pass `testnet` or `devnet` only when the user explicitly asked. The server rejects Solana `testnet` and EVM `devnet` instead of mapping them onto another cluster. An explicit testnet or devnet sign or send stays pending until the user confirms it in the popup. A missing confirmation signs nothing.

## Token lists

Mainnet balances in the popup, and `spacexpad_get_balance`, read the native asset from the RPC in `config.example.json`. Other fungible tokens come from `getTokenAccountsByOwner` on Solana (symbol is the shortened mint when metadata is unavailable) and from Blockscout token-balance endpoints on Ethereum, Base, and BNB Chain. NFTs are not listed. If that index fails, the result includes `tokenListError` and still returns the native balance when the RPC read succeeded. Public RPCs are rate limited. A failed native read is an error, not a zero balance.
