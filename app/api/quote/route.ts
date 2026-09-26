export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { z } from "zod";
import { encodeAbiParameters, keccak256, isAddress, parseEther } from "viem";
import { oracle, publicClient, abi } from "@/lib/server";
import { getPrices } from "@/lib/prices";
import { assets } from "@/lib/chain";
export async function POST(req: Request) {
  try {
    const body = z
      .object({
        user: z.string(),
        asset: z.number().int().min(0).max(2),
        up: z.boolean(),
        duration: z.union([z.literal(30), z.literal(60), z.literal(300)]),
        amount: z.string().regex(/^\d{1,3}(\.\d{1,18})?$/),
      })
      .safeParse(await req.json());
    if (!body.success)
      return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
    const { user, asset, up, duration, amount } = body.data;
    if (
      !isAddress(user) ||
      !Number.isInteger(asset) ||
      asset < 0 ||
      asset > 2 ||
      typeof up !== "boolean" ||
      ![30, 60, 300].includes(duration) ||
      typeof amount !== "string"
    )
      return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
    const stake = parseEther(amount);
    if (stake < parseEther("0.01") || stake > parseEther("10"))
      return Response.json({ error: "STAKE_LIMIT" }, { status: 400 });
    const o = oracle();
    const data = await getPrices();
    const p = data.prices[assets[asset].symbol];
    if (!p || Date.now() / 1000 - p.updatedAt > 600)
      throw new Error("PRICE_UNAVAILABLE");
    const price = BigInt(Math.round(p.price * 1e8));
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 45);
    const nonce = (await publicClient.readContract({
      address: o.address,
      abi,
      functionName: "nonces",
      args: [user],
    })) as bigint;
    const digest = keccak256(
      encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "address" },
          { type: "address" },
          { type: "uint8" },
          { type: "bool" },
          { type: "uint32" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "uint64" },
          { type: "uint256" },
        ],
        [
          10143n,
          o.address,
          user,
          asset,
          up,
          duration,
          stake,
          price,
          validUntil,
          nonce,
        ],
      ),
    );
    const signature = await o.account.signMessage({ message: { raw: digest } });
    return Response.json(
      { price: price.toString(), validUntil: validUntil.toString(), signature },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "QUOTE_UNAVAILABLE" }, { status: 503 });
  }
}
