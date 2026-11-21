---
name: spacexpad-agent-wallet
description: Use the SpaceXpad agent wallet through its local MCP server. Pair with a PAIR_CODE, then read balances, sign, or send. Omit network to use mainnet. Pass testnet or devnet only when the user explicitly asked.
---

# SpaceXpad agent wallet

The wallet is a Chrome extension for the launchpad at [https://spacexpad.xyz/](https://spacexpad.xyz/). Privy holds the keys. This skill talks to the local MCP server `spacexpad-agent-wallet`, which forwards each call to the extension over `http://127.0.0.1:47321`. The reserved public document is `https://spacexpad.xyz/agent-wallet/skill.md` and it is not published. The review copy in this repo is `docs/agent-wallet/skill.md`. Do not use the launchpad's `/skill`, `/skill.md`, or `/agents` pages for this extension. There is no hosted wallet endpoint.

The extension enforces the user's risk policy and kill switch. A testnet or devnet signature or send also waits for a confirmation in the extension popup. Nothing is signed until that confirmation. Mainnet does not ask that extra question.

## Install and run

From a checkout of this repository:

```bash
npm install
npm run build
node --experimental-strip-types mcp/src/index.ts
```

`npm run mcp` is the same process. Cursor or Claude Desktop:

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

The process prints a bridge token on stderr and writes `~/.spacexpad-agent-wallet/bridge.json`. The extension adopts that token from the local server on its own. Do not ask the user to paste a bridge token into Settings, and do not put the token in chat. The bridge accepts loopback clients only. `GET /v1/health` and `GET /v1/bootstrap` do not require the bearer token. Every other route does.

Discover tools from the running server. It registers only:

- `spacexpad_pair`
- `spacexpad_get_addresses`
- `spacexpad_get_balance`
- `spacexpad_sign_transaction`
- `spacexpad_send_transaction`

## Pair first

1. The user copies a prompt from the extension. It contains `PAIR_CODE:`.
2. Call `spacexpad_pair` with that code and your agent name.
3. Show the returned `spx_bind_...` token to the user and wait until they paste it into the extension bind screen. Do not ask them to paste a bridge token into Settings.
4. Do not call the other tools until that bind succeeds.

The code expires about 30 minutes after it was copied. The user can remove a binding in the extension.

## Mainnet unless the user names a test network

`chain` is required: `solana`, `ethereum`, `base`, or `bnb`.

Omit `network` to use mainnet. Do not pass `testnet` or `devnet` unless the user explicitly asked for that cluster.

Solana test traffic is `devnet`, not `testnet`. Ethereum and Base `testnet` means Sepolia. BNB Chain `testnet` means BSC testnet. `devnet` is only valid for Solana.

## Tools

- `spacexpad_get_addresses` — Solana address, and the one EVM address shared by Ethereum, Base, and BNB Chain.
- `spacexpad_get_balance` — native balance plus other fungible tokens. A zero native balance is a real read. If `tokenListError` is set, say that the token list failed instead of claiming the wallet holds only the native asset.
- `spacexpad_sign_transaction` — sign only. Return the signed transaction. Do not tell the user it was sent.
- `spacexpad_send_transaction` — sign and submit. Report a hash only if the tool result includes one. Status `submitted` means the RPC accepted it, not that it is confirmed.

`kind` is `native_transfer` (`to` + human `amount`) or `serialized` (hex or base64 transaction).

## Failures

Repeat the tool error. Common ones: extension not connected, bridge token mismatch, agents paused, test network not confirmed, whitelist miss, USD limit, missing price, user not signed in, RPC failure, Solana `testnet`, EVM `devnet`. Never invent a transaction hash or a balance.
