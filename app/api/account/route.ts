import { isAddress, createPublicClient, fallback, http } from "viem";
import { config, abi } from "@/lib/server";

const publicClient = createPublicClient({
  transport: fallback(
    [
      http(process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz", {
        timeout: 4000,
        retryCount: 0,
      }),
      http("https://monad-testnet.drpc.org", { timeout: 4000, retryCount: 0 }),
    ],
    { retryCount: 1, retryDelay: 1000 },
  ),
});

// viem forwards call options at runtime; keep the provider's eth_call gas cap explicit.
const readContract = (args: Parameters<typeof publicClient.readContract>[0] & { gas: bigint }) => publicClient.readContract(args);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Only fixed, read-only contract calls are exposed; this is not an open RPC proxy.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const account = query.get("address");
  const page = query.get("page") || "0";
  if ((account && !isAddress(account)) || !/^\d{1,6}$/.test(page))
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  const address = config().address;
  if (!address)
    return Response.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  try {
    const reserve = (await readContract({
      gas: 1000000n,
      address,
      abi,
      functionName: "availableReserve",
    })) as bigint;
    let balance = 0n;
    const rows = [];
    if (account && isAddress(account)) {
      const [b, n] = (await Promise.all([
        readContract({
          gas: 1000000n,
          address,
          abi,
          functionName: "balances",
          args: [account],
        }),
        readContract({
          gas: 1000000n,
          address,
          abi,
          functionName: "tradeCount",
          args: [account],
        }),
      ])) as [bigint, bigint];
      balance = b;
      const end = n > BigInt(page) * 20n ? n - BigInt(page) * 20n : 0n;
      const limit = end > 20n ? 20n : end;
      const ids = (await readContract({
        gas: 1000000n,
        address,
        abi,
        functionName: "tradeIds",
        args: [account, end - limit, limit],
      })) as bigint[];
      // Bound RPC concurrency instead of bursting up to twenty browser requests.
      for (let offset = 0; offset < ids.length; offset += 4) {
        if (offset) await new Promise((resolve) => setTimeout(resolve, 500));
        const chunk = await Promise.all(
          ids.slice(offset, offset + 4).map(async (id) => {
            const v = (await readContract({
              gas: 1000000n,
              address,
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
            return {
              id: String(id),
              user: v[0],
              asset: v[1],
              up: v[2],
              stake: String(v[3]),
              startPrice: String(v[4]),
              endPrice: String(v[5]),
              openedAt: String(v[6]),
              endsAt: String(v[7]),
              result: v[8],
              payout: String(v[9]),
            };
          }),
        );
        rows.push(...chunk);
      }
    }
    return Response.json(
      {
        reserve: String(reserve),
        balance: String(balance),
        rows: rows.reverse(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "CHAIN_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
