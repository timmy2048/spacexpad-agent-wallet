# SpaceXpad agent wallet

The launchpad is [https://spacexpad.xyz/](https://spacexpad.xyz/). On 21 November 2026 these paths were already live and belong to that site: `/` (launch prompts), `/skill` and `/skill.md` (the Solana fair-mint skill), and `/agents` (how agents participate). This extension does not use them.

The reserved setup prefix is [https://spacexpad.xyz/agent-wallet/](https://spacexpad.xyz/agent-wallet/). Both `/agent-wallet` and `/agent-wallet/` returned 404. `/wallet/` also 404, and was left alone because the homepage already talks about agent wallets for launches. Nothing was deployed. Pair codes and bridge tokens stay out of that URL. They appear only after someone copies a prompt or starts the local server.

Chrome extension for a keyless multi-chain vault. Privy creates the wallets and signs. A paired agent, through a local MCP server, can read balances, request a signature, or submit a transaction. The extension enforces the risk policy and the kill switch.

Solana, Ethereum, Base, and BNB Chain are supported. The wallet view and agent actions use mainnet unless the user, or the agent prompt, explicitly asks for testnet or devnet. Omitting `network` means mainnet. The server does not rewrite an explicit test network into mainnet, and it does not treat a missing network as a test network. An explicit testnet or devnet signature or send waits for confirmation in the popup. Nothing is signed if that confirmation does not arrive.

## Load the unpacked extension

```bash
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose **Load unpacked** and select the `dist` folder.

The unpacked extension ID is pinned by the manifest key:

`kgjgdglopjkfahcipgkpnnkenjnoineo`

Toolbar popup is the console. Gmail sign-in opens a separate window, because Chrome will not finish that OAuth redirect inside the toolbar popup.

`config.example.json` already contains the public development App ID `cmwqh29x000hj0glajlwjht0s`. The build copies that file to `dist/config.json`. There is no App Secret in this repo, and the extension never asks for one. A local `config.json` overrides the example if you create one. If the App ID is missing, the popup shows a setup screen instead of crashing.

## Privy

The development app is `cmwqh29x000hj0glajlwjht0s` on [dashboard.privy.io](https://dashboard.privy.io). Google login is already enabled there with Privy's shared OAuth credentials for this test. Email login still has to be turned on in the dashboard before the email code path works.

Automatic embedded-wallet creation in that dashboard applies only when a user signs in through Privy's own modal. This extension uses custom Google and email screens, so it does not rely on that toggle. `createOnLogin` is off. After authentication the extension calls `createWallet()` from `@privy-io/react-auth` for the EVM wallet and `createWallet()` from `@privy-io/react-auth/solana` for the Solana wallet, and only when that embedded wallet is not already on the user. Ethereum, Base, and BNB Chain then share the EVM address. Solana keeps its own base58 address.

Still required in the Privy dashboard for this unpacked build:

1. Enable **Email** login. Leave the other methods off besides Google.
2. Allowed origins: `chrome-extension://kgjgdglopjkfahcipgkpnnkenjnoineo`
3. Allowed OAuth redirect URL: `https://kgjgdglopjkfahcipgkpnnkenjnoineo.chromiumapp.org/`
4. Disable CAPTCHA and Telegram login so the extension does not expect those scripts.
5. App client: this build does not include a client ID because one was not issued. If login fails asking for an app client, create a client on that app, allow the origin and redirect above, and paste only the client ID into Settings. Do not paste an app secret.
6. Privy's shared Google client may reject this extension redirect. If Gmail returns a redirect error, attach your own Google OAuth client in the Privy Google settings. Keep that client secret in the Privy dashboard.

The unpacked extension ID comes from the public key in `manifest.json`. A later Chrome Web Store publish replaces it, and the origin and redirect above have to be updated to match.

Privy's embedded-wallet client still has to attach to some EVM chain when it loads. That attachment is not a product setting. The popup shows mainnet balances. Before a signature, the extension switches to the chain and cluster for that request and broadcasts through the RPC for that cluster. An omitted cluster is mainnet.

## Using the wallet

Sign in with Gmail or an email code. The username is a display name edited in Settings after login. It is stored only in this browser profile. The format check is 2–24 letters, numbers, or underscores. There is no account server and no global uniqueness check, so the same display name can exist on another device. Sign-in and wallet identity use the Privy user id (`auth.userId`) and the Solana plus EVM addresses, not the display name.

Hover or focus the `@username` row to copy addresses. The list is Solana, Ethereum, Base, and BNB Chain. The three EVM rows are the same `0x` address. Keyboard users can open the list from the button, tab to a copy control, and leave with Escape.

The asset list reads mainnet for all four chains after the wallets exist. A shown zero is a completed read. A failed RPC stays an error and is not displayed as zero. Other fungible tokens are listed under the chain that held them. Solana uses `getTokenAccountsByOwner` and shows a shortened mint when no symbol is available. Ethereum, Base, and BNB Chain use Blockscout's token-balance API. NFTs are not listed. If the token index fails, the native balance still shows and the index error is separate. An agent can still read an explicit testnet or devnet; that result is labeled and is not the default view.

Bind an agent from the Agent tab:

1. Start the local MCP server (see below) and paste its bridge token into Settings.
2. Copy the prompt. It contains `PAIR_CODE`, the real tool names, and the local command. It expires in 10 minutes.
3. Give it to the agent. The agent calls `spacexpad_pair` and shows an `spx_bind_...` token.
4. Paste that token into the extension. Remove the agent later to revoke it.

Settings cover language (简体中文, 繁體中文, English), username, and the risk policy. Full access is the default: no USD cap. You can switch on a single-transaction USD limit and a daily USD limit. An optional whitelist allows signing only when each destination is on the list (the recipient for a native transfer, the contract for a call, the mint for an SPL transfer). The kill switch pauses signing and sending for every agent. Balance reads still work. Resume is on the paused line and in Settings.

If a price is missing while a limit is on, the extension refuses the signature. It does not invent a transaction hash.

## MCP and skill

There is no hosted MCP URL. Setup is in `MCP.md`. From this repo:

```bash
npm install
npm run build
node --experimental-strip-types mcp/src/index.ts
```

`npm run mcp` is the same process. It listens on `127.0.0.1:47321`, requires a bearer token on every route except `GET /v1/health`, and rejects a non-loopback `Host`. The token is printed on stderr and written to `~/.spacexpad-agent-wallet/bridge.json`. Paste it into Settings. Override the port with `SPACEXPAD_BRIDGE_PORT` or the token with `SPACEXPAD_BRIDGE_TOKEN`.

Cursor or Claude Desktop:

```json
{
  "mcpServers": {
    "spacexpad-agent-wallet": {
      "command": "node",
      "args": ["--experimental-strip-types", "mcp/src/index.ts"],
      "cwd": "/absolute/path/to/this/repo"
    }
  }
}
```

The registered tools are `spacexpad_pair`, `spacexpad_get_addresses`, `spacexpad_get_balance`, `spacexpad_sign_transaction`, and `spacexpad_send_transaction`. The skill is `skill/spacexpad-agent-wallet/SKILL.md`.

Chain strings are `solana`, `ethereum`, `base`, and `bnb`. Omit `network` for mainnet. Solana does not accept `testnet` (use `devnet` only when the user asked for it). EVM chains do not accept `devnet` (Ethereum and Base testnet is Sepolia; BNB Chain testnet is BSC testnet). Explicit testnet or devnet signing waits for a popup confirmation.

Browser auto-handshake is not in this version. Pairing is the copy-prompt / paste-token flow.

## Develop

```bash
npm test
npm run check
npm run build
```

`npm test` covers mainnet as the omitted cluster, explicit testnet confirmation, asset grouping, the risk policy, pairing, and an MCP client that discovers the real tools. `npm run check` rejects `.then(`, `eval(`, and inline `onclick` in our sources.

Icons are generated by `npm run icons` from `assets/spacexpad-x-avatar.png`. The script does not read `assets/rocket.svg`. The manifest key is unchanged, so the unpacked extension id stays `kgjgdglopjkfahcipgkpnnkenjnoineo`.

RPC URLs live in `config.example.json` and can be overridden in `config.json`. Public RPCs are rate limited. A failed read is shown as an error.

## Store submission

Not part of this build. See `CHROMEWEBSTORE.md` for listing copy, permission justifications, and the asset checklist, and `PRIVACY.md` for the draft policy. Publishing will replace the unpacked extension ID. Update the Privy origin and redirect URL when that happens.
