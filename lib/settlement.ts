import { oracle, publicClient, abi } from "./server";
import { getPrices } from "./prices";
import { assets } from "./chain";
export async function settleTrade(id: bigint) {
  const o = oracle();
  const t = (await publicClient.readContract({
    address: o.address,
    abi,
    functionName: "trades",
    args: [id],
  })) as readonly [
    string,
    number,
    boolean,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    number,
    bigint,
  ];
  if (t[0] === "0x0000000000000000000000000000000000000000")
    throw new Error("NOT_FOUND");
  if (t[8] !== 0) return { status: "settled" as const };
  const block = await publicClient.getBlock();
  if (block.timestamp < t[7]) return { status: "pending" as const };
  let hash;
  if (block.timestamp > t[7] + 120n) {
    hash = await o.wallet.writeContract({
      address: o.address,
      abi,
      functionName: "refundExpired",
      args: [id],
    });
  } else {
    const data = await getPrices();
    const p = data.prices[assets[t[1]].symbol];
    if (!p || Date.now() / 1000 - p.updatedAt > 600)
      throw new Error("PRICE_UNAVAILABLE");
    hash = await o.wallet.writeContract({
      address: o.address,
      abi,
      functionName: "settle",
      args: [id, BigInt(Math.round(p.price * 1e8))],
    });
  }
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 45000,
  });
  if (receipt.status !== "success") throw new Error("SETTLEMENT_FAILED");
  return { status: "settled" as const, hash };
}
