---
name: spacexpad-agent-wallet
description: Use the SpaceXpad agent wallet through its local MCP server. Pair with a PAIR_CODE from the extension, then read addresses and balances, sign, or send. Omit network to use mainnet. Pass testnet or devnet only when the user explicitly asked.
---

# SpaceXpad agent wallet

This document is the setup for the SpaceXpad agent wallet Chrome extension. It is separate from the launchpad skill at `https://spacexpad.xyz/skill.md`.

Privy holds the keys. There is no seed phrase in the extension and no hosted wallet endpoint. A local MCP server on this computer forwards each call to the extension. The extension enforces the user's risk policy and kill switch.

Intended public URL, not published yet: `https://spacexpad.xyz/agent-wallet/skill.md`

## Install

You need Node.js 22 or newer and a checkout of the `spacexpad-agent-wallet` repository.

```bash
npm install
npm run build
node --experimental-strip-types mcp/src/index.ts
```

`npm run mcp` starts the same process. Load the unpacked extension from the `dist` folder. The extension id pinned by the manifest key is `kgjgdglopjkfahcipgkpnnkenjnoineo`.

The process speaks MCP on stdin and stdout. It also listens on `http://127.0.0.1:47321`. Only loopback clients are accepted. Every route except `GET /v1/health` requires `Authorization: Bearer <bridge token>`.

The bridge token is printed on stderr and written to `~/.spacexpad-agent-wallet/bridge.json`. The user pastes that token into the extension Settings. Do not ask for the token in chat, and do not put it in a URL.

Override the port with `SPACEXPAD_BRIDGE_PORT` or the token with `SPACEXPAD_BRIDGE_TOKEN`.

## Client configuration

Cursor or Claude Desktop:

```json
{
  "mcpServers": {
    "spacexpad-agent-wallet": {
      "command": "node",
      "args": ["--experimental-strip-types", "mcp/src/index.ts"],
      "cwd": "<absolute path to the spacexpad-agent-wallet repository>"
    }
  }
}
```

After the client connects, discover tools from the server. It registers only these:

- `spacexpad_pair`
- `spacexpad_get_addresses`
- `spacexpad_get_balance`
- `spacexpad_sign_transaction`
- `spacexpad_send_transaction`

Do not invent other tool names.

## Pair

1. The user copies a prompt from the extension. It contains `PAIR_CODE:`.
2. Call `spacexpad_pair` with that code and your agent name.
3. Show the returned token that starts with `spx_bind_` and wait until the user pastes it into the extension.
4. Do not call the other tools until that bind succeeds.

The code expires about 10 minutes after it was copied. The user can remove the binding in the extension. Do not put the pair code or the binding token in a public URL.

## Mainnet unless the user names a test network

`chain` is required: `solana`, `ethereum`, `base`, or `bnb`.

Omit `network` to use mainnet. The wallet view is mainnet as well. Pass `testnet` or `devnet` only when the user explicitly asked for that cluster. Do not choose a test network on your own.

Solana test traffic is `devnet`, not `testnet`. Ethereum and Base `testnet` means Sepolia. BNB Chain `testnet` means BSC testnet. `devnet` is valid only for Solana.

A testnet or devnet signature or send waits for confirmation in the extension. Nothing is signed until the user confirms. Mainnet does not ask that extra question. The risk policy and the kill switch still apply on every network.

## Tools

- `spacexpad_get_addresses` returns the Solana address and the one EVM address shared by Ethereum, Base, and BNB Chain. It does not select a network.
- `spacexpad_get_balance` reads the native balance and other fungible tokens for the chain you pass. A zero native balance is a completed read. If `tokenListError` is set, say the token list failed instead of claiming the wallet holds only the native asset. Solana token symbols that cannot be resolved are a shortened mint. NFTs are not listed.
- `spacexpad_sign_transaction` signs and returns the signed transaction. It does not broadcast. Do not tell the user it was sent.
- `spacexpad_send_transaction` signs and submits. Report a hash only when the result includes one. Status `submitted` means the RPC accepted it, not that it is confirmed.

`kind` is `native_transfer` (`to` plus a human `amount`) or `serialized` (a hex or base64 transaction).

## Failures

Repeat the tool error. Common ones: extension not connected, bridge token rejected, binding not recognized, agents paused, test network not confirmed, whitelist miss, USD limit, missing price, user not signed in, RPC failure, Solana `testnet`, EVM `devnet`. Never invent a transaction hash or a balance.
