// Independent settlement runner: keeps closing trades even when browsers are closed.
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
const { abi } = JSON.parse(fs.readFileSync("lib/contract.json", "utf8"));
if (!process.env.ORACLE_PRIVATE_KEY || !process.env.MONFLIP_CONTRACT)
  throw new Error(
    "Configure ORACLE_PRIVATE_KEY and MONFLIP_CONTRACT in .env.local",
  );
const chain = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"],
    },
  },
});
const client = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({
  chain,
  account: privateKeyToAccount(process.env.ORACLE_PRIVATE_KEY),
  transport: http(),
});
const address = process.env.MONFLIP_CONTRACT;
if ((await client.getChainId()) !== 10143) throw new Error("Testnet only");
let cursor = 0n;
const pending = new Set();
let cached;
async function prices() {
  if (cached && Date.now() - cached.at < 25000) return cached.data;
  const headers = process.env.COINGECKO_API_KEY
    ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY }
    : {};
  headers["User-Agent"] = "MonFlip/0.1 (Monad testnet hackathon; https://github.com/Saylool/monflip)";
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,monad&vs_currencies=usd&include_last_updated_at=true",
    { headers, signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new Error("Price unavailable");
  const data = await response.json();
  cached = { at: Date.now(), data };
  return data;
}
while (true) {
  try {
    const count = await client.readContract({
      address,
      abi,
      functionName: "nextId",
    });
    for (; cursor < count; cursor++) pending.add(cursor);
    for (const id of pending) {
      const trade = await client.readContract({
        address,
        abi,
        functionName: "trades",
        args: [id],
      });
      if (trade[8] !== 0) {
        pending.delete(id);
        continue;
      }
      const now = (await client.getBlock()).timestamp;
      if (now < trade[7]) continue;
      let name, args;
      if (now > trade[7] + 120n) {
        name = "refundExpired";
        args = [id];
      } else {
        const p = (await prices())[["bitcoin", "ethereum", "monad"][trade[1]]];
        if (
          !p ||
          !Number.isFinite(p.usd) ||
          p.usd <= 0 ||
          !Number.isFinite(p.last_updated_at) ||
          Date.now() / 1000 - p.last_updated_at > 600
        )
          continue;
        name = "settle";
        args = [id, BigInt(Math.round(p.usd * 1e8))];
      }
      const hash = await wallet.writeContract({
        address,
        abi,
        functionName: name,
        args,
      });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        pending.delete(id);
        console.log("Settled", String(id), hash);
      }
    }
  } catch (error) {
    console.error(error.shortMessage || error.message);
  }
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
