import { NextRequest, NextResponse } from "next/server";
import { alertOwnerLater, errorMessage } from "@/lib/alerts";
import { bookClass, type BookErrorCode } from "@/lib/classes/book";
import { bookClassInputSchema } from "@/lib/classes/schema";
import { consentContext } from "@/lib/marketing-server";
import { createRateLimiter, visitorKey } from "@/lib/rate-limit";

/**
 * POST /api/classes/book
 *
 * The booking form sends the class date, the number of seats, the
 * customer's details, the total they saw and a one-time card code from
 * Square's card form. The server holds the seats, saves the booking and
 * charges the card. See src/lib/classes/book.ts.
 */

const NO_STORE = { "Cache-Control": "no-store" };
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");

// The same limit as jar checkout: many card tries from one visitor look like
// someone testing stolen cards.
const rateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, maxPerWindow: 10 });

const STATUS_FOR: Partial<Record<BookErrorCode, number>> = {
  not_found: 404,
  closed: 409,
  full: 409,
  price_changed: 409,
  unavailable: 503,
  payment_unavailable: 503,
  payment_unconfirmed: 503,
  payment_declined: 402,
  payment_failed: 402,
};

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
      { ok: false, code: "invalid_input", message: "The booking form couldn't be read." },
      { status: 400, headers: NO_STORE }
    );
  }

  const parsed = bookClassInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Check the booking form." },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const result = await bookClass(parsed.data, consentContext(request));
    const status = result.ok ? 200 : (STATUS_FOR[result.code] ?? 422);
    return NextResponse.json(result, { status, headers: NO_STORE });
  } catch (error) {
    console.error("Class booking failed:", error instanceof Error ? error.message : "unknown error");
    alertOwnerLater({
      key: "class:crashed",
      title: "Class booking hit an unexpected error",
      message: `A class booking stopped partway (${errorMessage(error)}). The customer was asked to try again in a few minutes. The card may or may not have been charged, so check recent orders and Square.`,
      url: `${SITE_URL}/admin/orders`,
    });
    return NextResponse.json(
      {
        ok: false,
        code: "unavailable",
        message: "Class booking isn't working right now. Please try again in a few minutes.",
        retrySameCheckout: true,
      },
      { status: 500, headers: NO_STORE }
    );
  }
}
