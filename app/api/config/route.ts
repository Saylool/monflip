export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { config, publicClient } from "@/lib/server";
import { privateKeyToAccount } from "viem/accounts";
export async function GET() {
  const c = config();
  const oracle = c.key ? privateKeyToAccount(c.key).address : null;
  let relayFunded = false;
  let status = c.address && oracle ? "relay_unfunded" : "setup";
  if (oracle && c.address) {
    try {
      relayFunded = (await publicClient.getBalance({ address: oracle })) > 0n;
      if (relayFunded) status = "ready";
    } catch {
      status = "network_unavailable";
    }
  }
  return Response.json(
    {
      contract: c.address ?? null,
      oracle,
      status,
      ready: !!(c.address && c.key && relayFunded),
      chainId: 10143,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
