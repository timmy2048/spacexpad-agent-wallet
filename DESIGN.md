# SpaceXpad agent wallet

Operate surface. A 400×600 Chrome extension popup. The person checks a keyless vault and decides whether an agent may sign.

Visual treatment is interim. Magic Patterns comps for this popup are still to be applied. This file records the structure taken from the three wallet studies and the tokens currently in CSS. Do not treat the current colors or spacing as the final brand.

## What was studied

Public docs and the Rabby extension source, not brand assets. Nothing below is copied: no logos, no purple Phantom field, no Rabby blue, no MetaMask fox.

### Phantom

Sources: [Set up the Phantom browser extension](https://help.phantom.com/articles/set-up-the-phantom-browser-extension-4412436271635), [Manage your accounts](https://help.phantom.com/articles/manage-your-accounts-in-phantom-28355057809299), [Receive tokens](https://help.phantom.com/articles/receive-tokens-in-phantom-4406393831187).

- The toolbar icon opens Home. The account entry is the profile avatar at the upper left. On mobile Home, the account name sits above the balance.
- Receive is a list of networks, each with its own address and a copy control. Ethereum-style networks can share an address, but the sender still picks the network.
- Account names are private. Phantom says they are not visible to anyone else.
- Home is balance, then tokens, then the actions that exist (Send, Receive). A token row can show a network badge.

Taken: one account header, then assets, and an address list of exactly our four networks with copy. Not taken: Send, Swap, or Buy buttons. Those actions are not implemented in this popup. Signing stays with the agent and the risk policy. Not taken: a summed portfolio dollar figure. We only show a USD amount when DefiLlama returned a price.

### Rabby

Sources: [Rabby](https://rabby.io/), [supported networks](https://www.rabby.is/en/chains.html), and the extension home panel in [DashboardPanel](https://github.com/RabbyHub/Rabby/blob/9ba75133/src/ui/views/Dashboard/components/DashboardPanel/index.tsx) (`transactions`, `security` / approvals, `settings`).

- The home is one account, a balance, and a flat list of tokens across chains. The chain is part of the asset, not a separate app.
- The dashboard panel is a row of real destinations: transactions, approvals, settings. It is not a grid of feature cards.
- The product's distinguishing moment is the pre-sign explanation: what will change, on which chain, before the user confirms. Rabby also keeps testnets in the chain list (Sepolia, Base Sepolia) instead of hiding them inside a silent default.

Taken: flat rows, chain name on every group, and a confirm step only when the request is an explicit testnet or devnet. Not taken: automatic dapp network switching, allowance manager, or simulation of arbitrary contract calls. Our policy gate was already the kill switch, whitelist, and USD limits.

### MetaMask

Sources: [switch accounts](https://support.metamask.io/configure/accounts/switching-accounts-in-metamask/), [change networks](https://support.metamask.io/configure/networks/how-to-change-networks/), [display tokens](https://support.metamask.io/manage-crypto/tokens/how-to-display-tokens-in-metamask/), [activity](https://support.metamask.io/configure/transactions/how-do-i-find-my-transactions/).

- The account selector is the top of the extension. Renaming an account is a local label so the list is readable.
- Tokens and Activity are different places. Activity shows only transactions the wallet recorded, and each row can name the network.
- The current MetaMask home can show every enabled network at once. Filtering by network is explicit. The network used for a send is chosen in the send flow, not by leftover UI state.
- Token detection fills the list. A failed or missing token is not shown as a fake zero. Native gas tokens stay visible.

Taken: account header, a Wallet view and a separate Activity view, and a Settings place. The word Mainnet on our header is a label for the balances on screen. It is not a network switch. An omitted agent `network` is mainnet in the request handler. An explicit test cluster is not rewritten. Not taken: the fox, the network dropdown that changes what the wallet will sign, or auto-detected tokens beyond the RPC plus Blockscout and Solana token-account reads we already have.

## Density

The popup is 400px by 600px, inside the 380–400px extension width these three use. Header, account row, scrolling list, 56px bottom nav (Wallet, Agent, Activity, Settings). Type is 14px body, 15px account name, 12–13px meta. Addresses and amounts use JetBrains Mono with tabular figures. Inter is the UI face. Both are bundled with `@fontsource`. No third face.

## Interim visual

Radix Slate roles, not a component library: background Slate 1 `#111113`, raised strip Slate 2 `#18191b`, line Slate 6 `#363a3f`, text Slate 12 `#edeef0`, secondary Slate 11 `#b0b4ba`. Accent `#8ec8d4` is only the focus ring, the current nav tick, and the native progress bar. Danger text `#ff9592`. One 160ms ease. `prefers-reduced-motion: reduce` removes it.

No glow, no grid, no gradient text, no nested cards, no invented USD total, no invented activity. The four addresses are hidden until the pointer hovers the display name, or the keyboard focuses that button. The panel is an overlay, not a block in the asset list. `interestfor` / `popover="hint"` is still limited, so this is a plain disclosure. Copy buttons are in tab order. Escape returns focus to the account button.

The toolbar icon is the SpaceXpad X avatar at `assets/spacexpad-x-avatar.png`, a 1024×1024 PNG upscaled from the 192px frontend mark. `scripts/gen-icons.mjs` fits that file to 16, 32, 48, and 128 and stops if the file is missing. It does not draw a replacement and it does not read a rocket SVG.

## Site

The launchpad is [https://spacexpad.xyz/](https://spacexpad.xyz/). Its live prompts and docs stay on `/`, `/skill`, `/skill.md`, and `/agents`. This extension reserves [https://spacexpad.xyz/agent-wallet/skill.md](https://spacexpad.xyz/agent-wallet/skill.md), which returned 404 on 21 November 2026 and was not deployed. That file is separate from `/skill` and `/skill.md`. Pair codes and bridge tokens are not written into that URL or into pages that would be indexed.
