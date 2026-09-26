import { assets } from "@/lib/chain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("asset");
  const asset = assets.find((a) => a.symbol === symbol);
  if (!asset) return Response.json({ error: "INVALID_ASSET" }, { status: 400 });
  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "MonFlip/0.1 (Monad testnet hackathon; https://github.com/Saylool/monflip)",
    };
    if (process.env.COINGECKO_API_KEY)
      headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${asset.id}/market_chart?vs_currency=usd&days=1`,
      {
        headers,
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 60 },
      },
    );
    if (!response.ok) throw new Error("HISTORY_UNAVAILABLE");
    const data = (await response.json()) as { prices?: unknown };
    if (!Array.isArray(data.prices)) throw new Error("HISTORY_UNAVAILABLE");
    const cutoff = Date.now() / 1000 - 3600;
    const points = data.prices
      .filter(
        (p): p is [number, number] =>
          Array.isArray(p) &&
          p.length >= 2 &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1]) &&
          p[1] > 0,
      )
      .map(([time, price]) => ({ time: Math.floor(time / 1000), price }))
      .filter((p) => p.time >= cutoff && p.time <= Date.now() / 1000 + 60);
    if (!points.length) throw new Error("HISTORY_UNAVAILABLE");
    return Response.json(
      { points },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
    );
  } catch {
    return Response.json(
      { error: "HISTORY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
