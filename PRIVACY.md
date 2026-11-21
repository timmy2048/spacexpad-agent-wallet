# Privacy policy (draft)

This is a draft for the SpaceXpad agent wallet Chrome extension. Review it before any Chrome Web Store submission. It is not legal advice.

**Last updated:** 21 November 2026

SpaceXpad agent wallet is a local Chrome extension. It lets you sign in with Privy, see addresses and balances for Solana, Ethereum, Base, and BNB Chain, and let a paired agent request balances, signatures, and sends under a risk policy you control.

## Who holds the keys

Privy creates the embedded wallets and holds the key shares. The extension does not ask for a seed phrase, does not display one, and does not write private keys to `chrome.storage`. Signing happens in the extension page through the Privy SDK.

## Data stored on this device

The extension stores the following in `chrome.storage.local` on your computer:

- Your Privy App ID and optional client ID
- The local bridge token
- Display name, language, and risk-policy settings
- Bound agent names and binding tokens
- Wallet addresses after login
- Recent agent activity and, when a USD limit applies, how much has been sent today
- Cached balances. The popup reads mainnet after login. A testnet or devnet snapshot is stored only after an explicit request.

That data stays in the browser profile unless you remove the extension or clear extension storage.

## Data sent off the device

When you use the extension, it contacts:

- **Privy** (`auth.privy.io` and related Privy hosts) to sign you in with Gmail or an email code, to create the embedded wallets, and to sign. Privy's own privacy policy applies to that account.
- **RPC providers** you configure (public defaults are PublicNode and the public Solana RPC) to read balances and submit transactions.
- **Blockscout** to list fungible token balances on Ethereum, Base, and BNB Chain.
- **DefiLlama** (`coins.llama.fi`) to price assets when a USD value can be shown or a limit needs a price.
- **The local agent bridge** at `127.0.0.1` only, so a paired agent on this computer can request balances, signatures, and sends.

The extension does not include analytics, advertising, or a SpaceXpad account server.

## Agents

A paired agent can ask to read balances, sign, and send. You choose that when you paste the binding token. The extension refuses those requests when the kill switch is on, when a whitelist or USD limit blocks them, or when the bridge token does not match. Unpair an agent from the extension to stop accepting its token.

## Google sign-in

Gmail login is Privy's Google OAuth. The extension opens it in a separate window because Chrome does not complete that redirect inside the toolbar popup. Email login uses a one-time code and does not create a separate SpaceXpad password.

## Children

The extension is not directed at children.

## Changes

Update this draft before publishing, including the operator's legal name, contact email, and any RPC or pricing hosts you replace.
