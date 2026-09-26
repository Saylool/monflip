export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { oracle, publicClient, abi } from "@/lib/server";
import { getPrices } from "@/lib/prices";
import { assets } from "@/lib/chain";
let queue: Promise<unknown> = Promise.resolve();
async function settle(id: bigint) {
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
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (t[8] !== 0) return Response.json({ status: "settled" });
  const block = await publicClient.getBlock();
  if (block.timestamp < t[7]) return Response.json({ status: "pending" });
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
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 45000 });
  if (receipt.status !== "success") throw new Error("SETTLEMENT_FAILED");
  return Response.json({ status: "settled", hash });
}
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: unknown };
    const id = body?.id;
    if (typeof id !== "string" || !/^\d{1,12}$/.test(id))
      return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
    const job = queue.then(() => settle(BigInt(id)));
    queue = job.catch(() => {});
    return await job;
  } catch {
    return Response.json({ error: "SETTLEMENT_UNAVAILABLE" }, { status: 503 });
  }
}
