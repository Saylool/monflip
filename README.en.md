# MonFlip

**English** · [Türkçe](README.md)

[Live demo](https://monflip-snowy.vercel.app) · [Testnet contract](https://testnet.monadscan.com/address/0x37823aa03c00bf91b461fab176139c722952d0b0)

A bilingual Turkish / English price-direction demo on **Monad Testnet (10143)**. Predict BTC, ETH or MON direction over 30 seconds, 1 minute or 5 minutes using test MON. This is a hackathon prototype, not a real-money product.

## Try the demo

1. Open the [live app](https://monflip-snowy.vercel.app) and connect a browser wallet on Monad Testnet.
2. Get test MON from the [faucet](https://faucet.monad.xyz). Keep some in your wallet for network fees.
3. Use **Deposit** to add your personal trading balance.
4. Choose BTC, ETH or MON, select a duration and amount, then choose **Up** or **Down** and confirm in your wallet.
5. Follow the outcome under **Open predictions / History**. Use **Withdraw** to return available funds to your wallet.

You do not need to deploy a new contract to use the existing demo. **Setup reserve funding, settlement gas and personal trading balance are separate funds.**

## Trading rules

- Stake: **0.01–10 test MON**. Fixed **80% net profit** on a correct prediction (1.8× total payout, not leverage).
- Incorrect: stake lost. Equal recorded price: full refund.
- Each accepted trade reserves its complete maximum payout. User balances and pending payouts cannot finance other trades. New predictions stop when free house reserve is insufficient.
- Deposits, withdrawals, predictions and outcomes are stored on chain. The connected wallet owns its balance; no email account or off-chain balance database.
- There is no house withdrawal or administrator function that can remove reserved funds.

## Price and trust model

CoinGecko `/simple/price` provides USD reference prices. The server caches responses for 25 seconds and the UI polls every 30 seconds. The chart loads the last hour of real CoinGecko historical observations on arrival, then merges live responses by source timestamp. History is sampled at roughly five-minute intervals and cached for 60 seconds; it is not a second-by-second feed. No synthetic prices are used.

A **trusted centralized relay**, not a decentralized oracle, signs entry quotes and writes settlement prices. Quotes bind the wallet, contract, chain, asset, direction, duration, stake, price, deadline and account nonce. A dedicated relay wallet is immutable in the contract. Losing its key requires redeployment; an unresponsive relay cannot trap stakes indefinitely.

The duration starts when `open` is included on chain, not when the user clicks. The close price is the CoinGecko observation obtained on settlement after expiry; **it is not a guaranteed exact historical price at the expiry second**. As requested for this demo, CoinGecko source timestamps up to 10 minutes old are accepted. Repeated cached prices can cause refunds. The UI shows the source update time. Request failures never fabricate a price.

There is a 120-second settlement grace period. If settlement has not occurred by then, anyone can call `refundExpired` for a full refund. A durable Vercel Workflow is registered before a signed quote is returned. It discovers the on-chain trade by the wallet’s nonce/account-trade index, sleeps until expiry, and settles with retries even after the browser closes. Unused quotes stop watching after expiry. No always-on user computer is needed. Workflow quotas apply; extended outages can still require the timeout refund. The browser endpoint remains a fallback. Run only one keeper and avoid horizontal relay replicas for this small demo; pending nonce collisions are retried. Anyone can trigger an eligible settlement but cannot choose its price.

These relaxed timing rules are intentional demo limitations and can be exploited with faster external prices. **Do not fund with real assets or deploy to mainnet.** The constructor restricts deployment to Monad testnet and the local test chain.

## Run locally

Node.js 22.x and npm:

Clone the repository, then start the app:

```sh
git clone https://github.com/Saylool/monflip.git
cd monflip
npm ci
cp .env.example .env.local
npm run contracts:compile
npm run dev
```

Open [localhost:3000](http://localhost:3000). Without server secrets, the price interface is available but trading remains disabled.

Never commit `.env.local`, a private key or a mnemonic. Generate a dedicated testnet relay wallet and put its private key in the local environment / hosting secrets as `ORACLE_PRIVATE_KEY`. The web client receives only the public relay address. A CoinGecko Demo API key is optional but helpful for rate limits.

## Activate testnet

1. Visit `/setup` with a browser wallet on Monad testnet; obtain test MON from https://faucet.monad.xyz.
2. Fund the relay address with 0.1 test MON for settlement gas (displayed address comes from configured server secret).
3. Deploy via the setup page, choosing an initial house reserve (default 10 test MON). The transaction is signed in your wallet, never on the server.
   If deployment succeeded but the address was lost, recover it on `/setup` using the deployment transaction hash instead of deploying again.
4. Set the returned address as `MONFLIP_CONTRACT` in the server environment and republish / restart.
5. Vercel runs the durable settlement workflow automatically. For alternative hosting or recovery, the optional standalone runner can be started on an always-on host:

```sh
npm run keeper
```

## Deploy to Vercel from GitHub

Import `Saylool/monflip` at https://vercel.com/new. Select the Next.js framework preset, repository root, Node.js 22.x and leave build/output settings at their defaults. `npm run build` runs the native Next.js production build. Vercel automatically deploys future pushes to `main` once the Git integration is connected.

The price screen builds and runs without any secrets. For wallet trading, add these **server-only** environment variables in Vercel project settings:

- `ORACLE_PRIVATE_KEY`: dedicated testnet relay key. Never use a `NEXT_PUBLIC_` prefix.
- `MONFLIP_CONTRACT`: deployed contract address, after completing `/setup`.
- `COINGECKO_API_KEY`: optional Demo API key.
- `MONAD_RPC_URL`: optional; defaults to the Monad testnet public RPC.

Deploy first with the relay key, use `/setup`, then add the returned contract address and redeploy. The relay needs test MON for gas. Vercel runs the API routes as Node.js functions; it does **not** run `npm run keeper` continuously. The Workflow SDK provides durable background settlement on Vercel; a separate keeper host is optional. Local development workflows require the local server to stay running. Browser-triggered settlement and timeout refunds remain available. In-memory caching / serialization is per function instance, not a global lock.

`.env.local` remains ignored by Git and Vercel uploads. Do not paste secret values into source, deployment URLs or chat. The old `.openai/hosting.json` records the previous Sites deployment and is not used by Vercel.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

Contract integration tests use a local EVM, real signatures and mined transactions. They cover win/loss/tie/timeout accounting, reserve exhaustion, simultaneous wins, user withdrawals, stake limits, invalid signatures, replay prevention, foreign account replay and unauthorized settlement. These tests are not an independent security audit or proof of Monad deployment.

## Layout

- `contracts/MonFlip.sol`: escrow, reserve accounting, quote verification and settlement.
- `app/page.tsx`: responsive bilingual trading surface and browser wallet integration.
- `app/setup/page.tsx`: wallet-signed deployment and relay funding.
- `app/api/*`: CoinGecko proxy, public configuration, signed entry quotes and settlement relay.
- `workflows/prediction.ts`: durable quote watcher and automatic settlement.
- `scripts/keeper.mjs`: independent settlement service.
- `lib/contract.json`: ABI and compiled deployment bytecode; regenerate after contract changes.

Built with Next.js, React, viem and Solidity / OpenZeppelin. The source is MIT licensed.
