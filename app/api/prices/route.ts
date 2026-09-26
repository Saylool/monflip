export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getPrices } from "@/lib/prices";
export async function GET() {
  try {
    return Response.json(await getPrices(), {
      headers: { "Cache-Control": "public, max-age=20" },
    });
  } catch (error) {
    console.error("CoinGecko request:", error);
    return Response.json(
      { error: "PRICE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
