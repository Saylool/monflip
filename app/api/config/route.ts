import { config } from "@/lib/server";
import { privateKeyToAccount } from "viem/accounts";
export async function GET() {
  const c = config();
  return Response.json(
    {
      contract: c.address ?? null,
      oracle: c.key ? privateKeyToAccount(c.key).address : null,
      ready: !!(c.address && c.key),
      chainId: 10143,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
