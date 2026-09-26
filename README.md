# MonFlip

A bilingual Turkish / English price-direction demo on **Monad Testnet (10143)**. Predict BTC, ETH or MON direction over 30 seconds, 1 minute or 5 minutes using test MON. This is a hackathon prototype, not a real-money product.

## Trading rules

- Stake: **0.01–10 test MON**. Fixed **80% net profit** on a correct prediction (1.8× total payout, not leverage).
- Incorrect: stake lost. Equal recorded price: full refund.
- Each accepted trade reserves its complete maximum payout. User balances and pending payouts cannot finance other trades. New predictions stop when free house reserve is insufficient.
- Deposits, withdrawals, predictions and outcomes are stored on chain. The connected wallet owns its balance; no email account or off-chain balance database.
- There is no house withdrawal or administrator function that can remove reserved funds.

## Price and trust model

CoinGecko `/simple/price` provides USD reference prices. The server caches responses for 25 seconds and the UI polls every 30 seconds. No synthetic prices or generated historical chart points are used. The graph consists of observations received while the page is open.

A **trusted centralized relay**, not a decentralized oracle, signs entry quotes and writes settlement prices. Quotes bind the wallet, contract, chain, asset, direction, duration, stake, price, deadline and account nonce. A dedicated relay wallet is immutable in the contract. Losing its key requires redeployment; an unresponsive relay cannot trap stakes indefinitely.

The duration starts when `open` is included on chain, not when the user clicks. The close price is the CoinGecko observation obtained on settlement after expiry; **it is not a guaranteed exact historical price at the expiry second**. As requested for this demo, CoinGecko source timestamps up to 10 minutes old are accepted. Repeated cached prices can cause refunds. The UI shows the source update time. Request failures never fabricate a price.

There is a 120-second settlement grace period. If settlement has not occurred by then, anyone can call `refundExpired` for a full refund. Settlement is attempted by the open browser; run the independent keeper for automatic completion even when browsers close. The deployed site alone is not a scheduled keeper. Run only one keeper and avoid horizontal relay replicas for this small demo; pending nonce collisions are retried. Anyone can trigger an eligible settlement but cannot choose its price.

These relaxed timing rules are intentional demo limitations and can be exploited with faster external prices. **Do not fund with real assets or deploy to mainnet.** The constructor restricts deployment to Monad testnet and the local test chain.

## Run locally

Node 22.13+ and npm:

```sh
npm ci
cp .env.example .env.local
npm run contracts:compile
npm run dev
```

Never commit `.env.local`, a private key or a mnemonic. Generate a dedicated testnet relay wallet and put its private key in the local environment / hosting secrets as `ORACLE_PRIVATE_KEY`. The web client receives only the public relay address. A CoinGecko Demo API key is optional but helpful for rate limits.

## Activate testnet

1. Visit `/setup` with a browser wallet on Monad testnet; obtain test MON from https://faucet.monad.xyz.
2. Fund the relay address with 0.1 test MON for settlement gas (displayed address comes from configured server secret).
3. Deploy via the setup page, choosing an initial house reserve (default 10 test MON). The transaction is signed in your wallet, never on the server.
4. Set the returned address as `MONFLIP_CONTRACT` in the server environment and republish / restart.
5. Start the independent settlement runner on an always-on host:

```sh
npm run keeper
```

For Sites deployment, set server environment values through Sites and deploy the same source version. `.openai/hosting.json` contains site identity only, never keys. Source is public; site access and contract activation are separate.

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
- `scripts/keeper.mjs`: independent settlement service.
- `lib/contract.json`: ABI and compiled deployment bytecode; regenerate after contract changes.

Built with React, Vinext, viem and Solidity / OpenZeppelin. The source is MIT licensed.
