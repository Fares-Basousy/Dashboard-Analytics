import { getCredentials } from "@/lib/credentials/store";
import { MAX_ORDERS_PER_RUN, runShopifySeed, type SeedEvent } from "@/lib/seed/shopify-seed";

/** Seeding paces orders (dev-store limit), so a run takes a few minutes. */
export const maxDuration = 300;

const MAX_DAYS = 90;

/** One run at a time per server instance – two parallel runs would only hit Shopify's rate limit. */
let running = false;

/**
 * POST /api/seed { orders?, days? } – fill the connected Shopify DEV store with test data.
 * Streams progress as NDJSON (one SeedEvent per line) so the UI can show a live status.
 * Uses the visitor's Shopify credentials (browser cookie, else server env). Never writes to a real shop:
 * the seed refuses stores that are not development stores.
 */
export async function POST(req: Request) {
  const body: { orders?: unknown; days?: unknown } = await req.json().catch(() => ({}));
  const orders = Number(body.orders ?? 10);
  const days = Number(body.days ?? 30);
  if (!Number.isInteger(orders) || orders < 1 || orders > MAX_ORDERS_PER_RUN || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return Response.json({ error: `orders must be 1–${MAX_ORDERS_PER_RUN}, days 1–${MAX_DAYS}` }, { status: 400 });
  }
  if (running) return Response.json({ error: "A seed run is already in progress." }, { status: 409 });

  const creds = await getCredentials();
  const encoder = new TextEncoder();
  running = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SeedEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runShopifySeed(creds, { orders, days, signal: req.signal, onEvent: send });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Seeding failed." });
      } finally {
        running = false;
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
