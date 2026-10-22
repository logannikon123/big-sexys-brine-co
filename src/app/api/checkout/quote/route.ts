import { NextRequest, NextResponse } from "next/server";
import { quoteInputSchema } from "@/lib/checkout/schema";
import {
  getQuote,
  quoteForBrowser,
  type BrowserQuote,
  type QuoteError,
  type QuoteErrorCode,
  type QuoteResult,
} from "@/lib/checkout/quote";
import { createRateLimiter, visitorKey } from "@/lib/rate-limit";

/**
 * POST /api/checkout/quote
 *
 * The checkout page sends the cart (product IDs and quantities) and the
 * pickup, delivery or shipping choice. The server answers with every line of
 * the bill, worked out from the database. Nothing here is cached, and the
 * delivery starting point never appears in the answer.
 */

const NO_STORE = { "Cache-Control": "no-store" };

// A limit on how often one visitor can ask for quotes. Each quote can call
// the Census and OpenRouteService (which has a daily allowance), and many
// quotes from one visitor could help someone work out where delivery
// distance is measured from.
const rateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, maxPerWindow: 30 });

// Problems the customer can fix get 422. Services that are down get 503.
const STATUS_FOR: Partial<Record<QuoteErrorCode, number>> = {
  unavailable: 503,
  address_service_down: 503,
  store_closed: 403,
};

/**
 * What the browser sees. Delivery miles are shown to one decimal place: the
 * customer needs no more, and finer figures would make it easier to work out
 * the private starting point from many quotes. The tax split by city and
 * county stays on the server: it is saved with the order for the tax report.
 */
function forBrowser(result: QuoteResult): BrowserQuote | QuoteError {
  if (!result.ok) return result;
  const quote = quoteForBrowser(result);
  if (quote.fulfillment.type !== "local_delivery") return quote;
  return {
    ...quote,
    fulfillment: {
      ...quote.fulfillment,
      miles: Math.round(quote.fulfillment.miles * 10) / 10,
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
