import { assets } from "./chain";
export type QuotePrice = {
  price: number;
  updatedAt: number;
  change: number | null;
};
let cache:
  { fetchedAt: number; prices: Record<string, QuotePrice> } | undefined;
let pending: Promise<NonNullable<typeof cache>> | undefined;
export async function getPrices() {
  if (cache && Date.now() - cache.fetchedAt < 25000) return cache;
  if (pending) return pending;
  pending = (async () => {
    const headers: Record<string, string> = {"User-Agent":"MonFlip/0.1 (Monad testnet hackathon; https://github.com/Saylool/monflip)"};
    if (process.env.COINGECKO_API_KEY)
      headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,monad&vs_currencies=usd&include_last_updated_at=true&include_24hr_change=true",
      { headers, signal: AbortSignal.timeout(10000) },
    );
    if (!r.ok)
      throw new Error(
        "PRICE_UNAVAILABLE HTTP " +
          r.status +
          " " +
          (await r.text()).slice(0, 180),
      );
    const data = (await r.json()) as Record<
      string,
      { usd: number; last_updated_at: number; usd_24h_change?: number }
    >;
    const prices: Record<string, QuotePrice> = {};
    for (const a of assets) {
      const p = data[a.id];
      if (
        p &&
        Number.isFinite(p.usd) &&
        p.usd > 0 &&
        Number.isFinite(p.last_updated_at)
      )
        prices[a.symbol] = {
          price: p.usd,
          updatedAt: p.last_updated_at,
          change:
            typeof p.usd_24h_change === "number" &&
            Number.isFinite(p.usd_24h_change)
              ? p.usd_24h_change
              : null,
        };
    }
    if (!Object.keys(prices).length) throw new Error("PRICE_UNAVAILABLE");
    cache = { prices, fetchedAt: Date.now() };
    return cache;
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
