# Chrome Web Store notes

Draft for a later submission. Do not upload this build until the listing, privacy policy, and Privy production app are reviewed. Publishing assigns a new extension ID. The unpacked ID pinned by `manifest.json` is `kgjgdglopjkfahcipgkpnnkenjnoineo`. The development Privy App ID `cmwqh29x000hj0glajlwjht0s` is public and is already in `config.example.json`. Do not add an app secret to the package. After publish, add the new `chrome-extension://` origin and `https://<new-id>.chromiumapp.org/` redirect in the Privy dashboard.

## Listing

**Name:** SpaceXpad agent wallet

**Summary:** Keyless multi-chain wallet for agents. Privy holds the keys. You set the risk policy.

**Category:** Productivity

**Language:** English. The popup also offers 简体中文 and 繁體中文.

**Description:**

SpaceXpad agent wallet is a keyless vault for Solana, Ethereum, Base, and BNB Chain, for the launchpad at https://spacexpad.xyz/. Setup for this extension is reserved at https://spacexpad.xyz/agent-wallet/ and that page is not published. The live launchpad paths (`/`, `/skill`, `/agents`) are separate. You sign in with Gmail or an email code. Privy creates the wallets and signs. You never see a seed phrase.

A paired agent on your computer can read balances, request a signature, or submit a transaction through a local MCP server on 127.0.0.1. The wallet shows mainnet balances. Agent calls use mainnet unless the request explicitly names a testnet or devnet. A test network signature waits for confirmation in the extension.

You can leave signing uncapped, or set a single-transaction USD limit and a daily USD limit. An optional whitelist restricts destinations. A kill switch pauses every agent. The extension refuses a signature it cannot price when a limit is on, and it never reports a transaction hash it did not receive.

## Single purpose

Give the signed-in user a Privy embedded wallet and a local bridge so a paired agent can read balances and request signatures or sends, under a risk policy stored in the extension.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Language, username, risk policy, bound agents, activity, and cached balances. |
| `identity` | Gmail OAuth redirect for Privy (`https://<id>.chromiumapp.org/`). |
| `offscreen` | Keep the Privy session and the local agent bridge alive while the toolbar popup is closed, using extension local storage. |
| `alarms` | Recreate that offscreen document if Chrome suspends it. |

`action` is declared because the extension uses a toolbar popup.

## Host permissions

| Host | Why |
| --- | --- |
| `https://auth.privy.io/*`, `https://api.privy.io/*`, `https://*.privy.io/*`, `https://*.rpc.privy.systems/*` | Privy login and embedded-wallet signing. |
| PublicNode and public Solana RPC hosts | Mainnet balance reads by default, plus a testnet or devnet read or broadcast only when that cluster was explicitly requested. |
| Blockscout hosts for Ethereum, Base, and BNB Chain, including Sepolia, Base Sepolia, and BSC testnet | Fungible token lists. |
| `https://coins.llama.fi/*` | USD prices for display and for limit checks. |
| `http://127.0.0.1:47321/*` | Local MCP bridge. It is not a remote server. |

No `tabs`, `history`, `<all_urls>`, or content scripts.

## Remote code

The package does not load remote extension scripts. CAPTCHA libraries are stubbed. Telegram login is not enabled, and the Telegram loader URL is stripped from the bundle. Stripe onramp is stubbed so its hosted script is not shipped. Privy still runs its wallet iframe from `auth.privy.io`, which is the key-holding component and is called out here for review.

Before upload, confirm the dashboard has CAPTCHA and Telegram disabled, and search the zip for `telegram-login.js`, `challenges.cloudflare.com`, `js.hcaptcha.com`, and `crypto-js.stripe.com`.

## Privacy

- The extension does not sell user data.
- It does not use data for advertising or creditworthiness.
- Authentication and wallet custody go to Privy.
- Balance and price lookups go to the RPC, Blockscout, and DefiLlama hosts above.
- Agent requests stay on localhost.
- Draft policy: `PRIVACY.md`. Replace the placeholder operator contact before submission.

Data-use answers for the form:

- Personally identifiable information: email address, via Privy login.
- Authentication information: Privy session, stored by the Privy SDK in extension local storage.
- Financial and payment information: public wallet addresses, balances, and transaction requests.
- Personal communications: none.
- Location, web history, user activity on the web: none.

## Assets checklist

- [x] `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png` from `assets/spacexpad-x-avatar.png` via `scripts/gen-icons.mjs`. The script fails if that file is missing. It does not read a rocket SVG.
- [ ] 1280×800 screenshot of the sign-in screen
- [ ] 1280×800 screenshot of the console with the address popover open
- [ ] 1280×800 screenshot of Settings (language, limits, kill switch)
- [ ] Optional small promo tile, 440×280
- [ ] Privacy policy URL once `PRIVACY.md` is hosted
- [ ] Confirm the production Privy app ID, allowed origin, and OAuth redirect match the published extension ID

Do not submit screenshots that show another person's balances or a live mainnet key.
