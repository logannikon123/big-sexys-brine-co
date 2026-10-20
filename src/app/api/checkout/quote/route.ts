import { NextRequest, NextResponse } from "next/server";
import { quoteInputSchema } from "@/lib/checkout/schema";
import { getQuote, type QuoteErrorCode, type QuoteResult } from "@/lib/checkout/quote";

/**
 * POST /api/checkout/quote
 *
 * The checkout page sends the cart (product IDs and quantities) and the
 * pickup, delivery or shipping choice. The server answers with every line of
 * the bill, worked out from the database. Nothing here is cached, and the
 * delivery starting point never appears in the answer.
 */

const NO_STORE = { "Cache-Control": "no-store" };

// A simple limit on how often one visitor can ask for quotes. Each quote can
// call the Census and OpenRouteService (which has a daily allowance), and
// many quotes from one visitor could help someone work out where delivery
// distance is measured from. The counts live in this server's memory, so
// they reset on a restart and aren't shared between Vercel's servers: a
// speed bump, not a wall.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const MAX_TRACKED_VISITORS = 5000;
const recent = new Map<string, number[]>();

function rateLimited(visitor: string, now: number): boolean {
  const times = (recent.get(visitor) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    recent.set(visitor, times);
    return true;
  }
  times.push(now);
  recent.set(visitor, times);
  if (recent.size > MAX_TRACKED_VISITORS) {
    for (const [key, list] of recent) {
      if (list.every((t) => now - t >= WINDOW_MS)) recent.delete(key);
    }
  }
  return false;
}

function visitorKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

// Problems the customer can fix get 422. Services that are down get 503.
const STATUS_FOR: Partial<Record<QuoteErrorCode, number>> = {
  unavailable: 503,
  address_service_down: 503,
  store_closed: 403,
};

/**
 * What the browser sees. Delivery miles are shown to one decimal place: the
 * customer needs no more, and finer figures would make it easier to work out
 * the private starting point from many quotes.
 */
function forBrowser(result: QuoteResult): QuoteResult {
  if (!result.ok || result.fulfillment.type !== "local_delivery") return result;
  return {
    ...result,
    fulfillment: {
      ...result.fulfillment,
      miles: Math.round(result.fulfillment.miles * 10) / 10,
    },
  };
}

export async function POST(request: NextRequest) {
  if (rateLimited(visitorKey(request), Date.now())) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: "Too many price checks. Please wait a few minutes and try again." },
      { status: 429, headers: NO_STORE }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_input", message: "The checkout form couldn't be read." },
      { status: 400, headers: NO_STORE }
    );
  }

  const parsed = quoteInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Check the checkout form.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const result = await getQuote(parsed.data);
    const status = result.ok ? 200 : (STATUS_FOR[result.code] ?? 422);
    return NextResponse.json(forBrowser(result), { status, headers: NO_STORE });
  } catch (error) {
    console.error(
      "Checkout quote failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return NextResponse.json(
      { ok: false, code: "unavailable", message: "Online ordering isn't working right now. Please try again in a few minutes." },
      { status: 500, headers: NO_STORE }
    );
  }
}
