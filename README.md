# SpaceXpad agent wallet

Chrome extension for a keyless multi-chain vault. Privy creates the wallets and signs. A paired agent, through a local MCP server, can read balances, request a signature, or submit a transaction. The extension enforces the risk policy and the kill switch.

There is no wallet-level network and no default cluster. Solana, Ethereum, Base, and BNB Chain are all supported on mainnet and on testnet/devnet, and every agent call names both the chain and the cluster.

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

Privy's embedded-wallet client still has to attach to some EVM chain when it loads. That attachment is not a product setting. The popup has no network control. Before a signature, the extension switches to the chain the agent named and broadcasts through the RPC for that cluster.

## Using the wallet

Sign in with Gmail or an email code. The username is edited in Settings after login.

Hover the `@username` row to copy addresses. The list is Solana, Ethereum, Base, and BNB Chain. The three EVM rows are the same `0x` address.

Assets are grouped under those four chains. Until an agent requests a cluster, each chain shows its native asset at 0 with the note that it has not been read. That 0 is not an on-chain result. After `spacexpad_get_balance` (or a send) names a chain and a cluster, the extension reads that cluster and lists the native balance, including a real 0, plus other fungible tokens it can see. NFTs are not listed. A failed token index is shown as an error; it is not reported as an empty wallet. Solana token symbols that cannot be resolved are shown as a shortened mint.

Bind an agent from the console when none are bound:

1. Copy the prompt. It contains `PAIR_CODE` and the permissions.
2. Give it to the agent. The agent calls `spacexpad_pair` and shows an `spx_bind_...` token.
3. Paste that token into the extension.

Settings cover language (简体中文, 繁體中文, English), username, and the risk policy. Full access is the default: no USD cap. You can switch on a single-transaction USD limit and a daily USD limit. An optional whitelist allows signing only when each destination is on the list (the recipient for a native transfer, the contract for a call, the mint for an SPL transfer). The kill switch pauses signing and sending for every agent. Balance reads still work. Resume is on the paused line and in Settings.

If a price is missing while a limit is on, the extension refuses the signature. It does not invent a transaction hash.

## MCP and skill

Start the bridge from this repo:

```bash
npm run mcp
```

It listens on `127.0.0.1:47321` and prints a bridge token. Paste that token into Settings. The token is also written to `~/.spacexpad-agent-wallet/bridge.json`. Override the port with `SPACEXPAD_BRIDGE_PORT` or the token with `SPACEXPAD_BRIDGE_TOKEN`. The process uses stdout for MCP, so the token is printed on stderr.

Claude Desktop or Cursor MCP config:

```json
{
  "mcpServers": {
    "spacexpad-agent-wallet": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/this/repo"
    }
  }
}
```

The skill the agent should follow is `skill/spacexpad-agent-wallet/SKILL.md`.

Chain strings are `solana`, `ethereum`, `base`, and `bnb`. Network strings are `mainnet`, `testnet`, and `devnet`. Solana does not accept `testnet` (use `devnet`). EVM chains do not accept `devnet` (Ethereum and Base testnet is Sepolia; BNB Chain testnet is BSC testnet). If the user did not name both, the agent should ask.

Browser auto-handshake is not in this version. Pairing is the copy-prompt / paste-token flow.

## Develop

```bash
npm test
npm run check
npm run build
```

`npm test` covers cluster selection, asset grouping, the risk policy, pairing, and transaction destination parsing. `npm run check` rejects `.then(`, `eval(`, and inline `onclick` in our sources.

RPC URLs live in `config.example.json` and can be overridden in `config.json`. Public RPCs are rate limited. A failed read is shown as an error.

## Store submission

Not part of this build. See `CHROMEWEBSTORE.md` for listing copy, permission justifications, and the asset checklist, and `PRIVACY.md` for the draft policy. Publishing will replace the unpacked extension ID. Update the Privy origin and redirect URL when that happens.
