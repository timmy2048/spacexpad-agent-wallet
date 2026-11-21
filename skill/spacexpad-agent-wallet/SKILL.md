---
name: spacexpad-agent-wallet
description: Use the SpaceXpad agent wallet through its local MCP server. Pair with a PAIR_CODE, then read balances, sign, or send on a chain and cluster the user named. There is no default network.
---

# SpaceXpad agent wallet

The wallet is a Chrome extension. Privy holds the keys. This skill talks to the local MCP server `spacexpad-agent-wallet`, which forwards each call to the extension. The extension enforces the user's risk policy and kill switch.

## Pair first

1. The user copies a prompt from the extension. It contains `PAIR_CODE:`.
2. Call `spacexpad_pair` with that code and your agent name.
3. Show the returned `spx_bind_...` token to the user and wait until they paste it into the extension.
4. Do not call the other tools until that bind succeeds.

## No default chain or network

Every balance, sign, and send call must include both:

- `chain`: `solana` | `ethereum` | `base` | `bnb`
- `network`: `mainnet` | `testnet` | `devnet`

Solana accepts `mainnet` or `devnet` only. Do not send `testnet` for Solana.
Ethereum and Base `testnet` means Sepolia. BNB Chain `testnet` means BSC testnet.
`devnet` is only valid for Solana.

If the user did not name both the chain and the cluster, ask. Do not guess, and do not reuse a previous cluster as a default.

## Tools

- `spacexpad_get_addresses` — Solana address, and the one EVM address shared by Ethereum, Base, and BNB Chain.
- `spacexpad_get_balance` — native balance plus other fungible tokens on the chain and cluster you pass. A zero native balance is a real read. If `tokenListError` is set, say that the token list failed instead of claiming the wallet holds only the native asset.
- `spacexpad_sign_transaction` — sign only. Return the signed transaction. Do not tell the user it was sent.
- `spacexpad_send_transaction` — sign and submit. Report a hash only if the tool result includes one. Status `submitted` means the RPC accepted it, not that it is confirmed.

`kind` is `native_transfer` (`to` + human `amount`) or `serialized` (hex or base64 transaction).

## Failures

Repeat the tool error. Common ones: extension not connected, bridge token mismatch, agents paused, whitelist miss, USD limit, missing price, user not signed in, RPC failure. Never invent a transaction hash or a balance.
