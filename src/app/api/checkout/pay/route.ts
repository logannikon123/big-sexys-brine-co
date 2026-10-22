import { NextRequest, NextResponse } from "next/server";
import { alertOwnerLater, errorMessage } from "@/lib/alerts";
import { payInputSchema } from "@/lib/checkout/schema";
import { placeOrder, type PayErrorCode, type PayResult } from "@/lib/checkout/pay";
import { quoteForBrowser } from "@/lib/checkout/quote";
import { consentContext } from "@/lib/marketing-server";
import { createRateLimiter, visitorKey } from "@/lib/rate-limit";

/**
 * POST /api/checkout/pay
 *
 * The checkout page sends the cart, the pickup, delivery or shipping choice,
 * the customer's details, the total they saw and a one-time card code from
 * Square's card form. The server works out the price again, saves the order
 * and charges the card. See src/lib/checkout/pay.ts.
 */

const NO_STORE = { "Cache-Control": "no-store" };
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");

// Fewer tries than quotes: each one can reach Square, and many card tries
// from one visitor look like someone testing stolen cards.
const rateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, maxPerWindow: 10 });

const STATUS_FOR: Partial<Record<PayErrorCode, number>> = {
  unavailable: 503,
  address_service_down: 503,
  payment_unavailable: 503,
  payment_unconfirmed: 503,
  store_closed: 403,
  price_changed: 409,
  payment_declined: 402,
  payment_failed: 402,
};

/**
 * Delivery miles go to the browser rounded, and the tax split stays on the
 * server, as in the quote route.
 */
function forBrowser(result: PayResult) {
  if (result.ok || !result.quote) return result;
  const quote = quoteForBrowser(result.quote);
  if (quote.fulfillment.type !== "local_delivery") return { ...result, quote };
  return {
    ...result,
    quote: {
      ...quote,
      fulfillment: {
        ...quote.fulfillment,
        miles: Math.round(quote.fulfillment.miles * 10) / 10,
      },
    },
  };
}

export async function POST(request: NextRequest) {
  if (rateLimited(visitorKey(request), Date.now())) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: "Too many tries. Please wait a few minutes and try again." },
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

  const parsed = payInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Check the checkout form.",
      },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const result = await placeOrder(parsed.data, consentContext(request));
    const status = result.ok ? 200 : (STATUS_FOR[result.code] ?? 422);
    return NextResponse.json(forBrowser(result), { status, headers: NO_STORE });
  } catch (error) {
    console.error(
      "Checkout payment failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    alertOwnerLater({
      key: "checkout:crashed",
      title: "Checkout hit an unexpected error",
      message: `A customer's payment stopped partway (${errorMessage(error)}). They were asked to try again in a few minutes. The card may or may not have been charged, so check recent orders and Square.`,
      url: `${SITE_URL}/admin/orders`,
    });
    return NextResponse.json(
      {
        ok: false,
        code: "unavailable",
        message: "Online ordering isn't working right now. Please try again in a few minutes.",
        retrySameCheckout: true,
      },
      { status: 500, headers: NO_STORE }
    );
  }
}
