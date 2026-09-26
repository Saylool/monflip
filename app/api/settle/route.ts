export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { settleTrade } from "@/lib/settlement";
let queue: Promise<unknown> = Promise.resolve();
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: unknown };
    const id = body?.id;
    if (typeof id !== "string" || !/^\d{1,12}$/.test(id))
      return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
    const job = queue.then(() => settleTrade(BigInt(id)));
    queue = job.catch(() => {});
    return Response.json(await job);
  } catch {
    return Response.json({ error: "SETTLEMENT_UNAVAILABLE" }, { status: 503 });
  }
}
