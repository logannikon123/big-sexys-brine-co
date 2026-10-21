import "server-only";
import { SquareError, type Square, type SquareClient } from "square";

/**
 * Reading Square's answers at checkout.
 *
 * Square uses the checkout ID as its idempotency key: sent twice with the
 * same request, it charges once and gives the first answer again. Sent with
 * a different request (a new card code, say), it answers
 * IDEMPOTENCY_KEY_REUSED and doesn't say whether the first one went through.
 * That answer, a Square outage, a rate limit, a timeout or a lost connection
 * all leave us not knowing whether the card was charged. In those cases
 * checkout asks Square for the payment itself (findSquarePayment) before it
 * tells the customer anything.
 */

/** What a failed payments.create call tells us. */
export type SquareFailure =
  /** Square answered and took no money: a declined card, or a request it refused. */
  | { kind: "rejected"; code: string; category: string }
  /** We don't know whether the card was charged. */
  | { kind: "unknown"; code: string; keyReused: boolean };

export function readSquareFailure(error: unknown): SquareFailure {
  if (!(error instanceof SquareError)) {
    // A timeout or a bug: the request may have reached Square.
    return { kind: "unknown", code: error instanceof Error ? error.name : "unknown", keyReused: false };
  }
  const first = error.errors[0];
  const code = String(first?.code ?? "Unknown");
  const category = String(first?.category ?? "");
  const status = error.statusCode;

  if (code === "IDEMPOTENCY_KEY_REUSED") return { kind: "unknown", code, keyReused: true };

  // The SDK turns a lost connection or a page that isn't Square's JSON into
  // a SquareError with no status, or with a made-up "Unknown" error. Square
  // outages (5xx), timeouts (408), clashes with a request still running
  // (409) and rate limits (429) come with a status. None of these say
  // whether the card was charged.
  const squareAnswered =
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    ![408, 409, 429].includes(status) &&
    code !== "Unknown" &&
    category !== "V1_ERROR" &&
    category !== "API_ERROR" &&
    category !== "RATE_LIMIT_ERROR";
  if (!squareAnswered) return { kind: "unknown", code, keyReused: false };
  return { kind: "rejected", code, category };
}

/** The order a payment is for, as checkout saved it. */
export interface PaymentLookup {
  /** Square's payment ID, if an earlier try saved one. */
  paymentId: string | null;
  orderNumber: number;
  totalCents: number;
  /** When the order was saved. Its payment can't be older. */
  createdAt: string;
  locationId?: string;
}

export type LookupResult =
  | { kind: "found"; payment: Square.Payment }
  | { kind: "none" }
  | { kind: "unknown" };

/** At most this many pages of 100 payments are read before giving up. */
const MAX_PAGES = 5;

/**
 * Ask Square whether it has a payment for this order: by payment ID if we
 * have one, or else by our order number, which checkout sends as the
 * payment's reference ID. Square has no search by idempotency key or
 * reference ID, so this lists the shop's payments since the order was saved
 * and picks the one with our order number and amount. Market sales show up
 * in that list too, which is why the amount must match as well.
 */
export async function findSquarePayment(
  client: SquareClient,
  order: PaymentLookup
): Promise<LookupResult> {
  try {
    if (order.paymentId) {
      const { payment } = await client.payments.get({ paymentId: order.paymentId });
      return payment ? { kind: "found", payment } : { kind: "unknown" };
    }

    // A minute early, in case Square's clock and ours differ.
    const begin = new Date(new Date(order.createdAt).getTime() - 60_000).toISOString();
    let page = await client.payments.list({
      beginTime: begin,
      ...(order.locationId ? { locationId: order.locationId } : {}),
      sortOrder: "ASC",
      limit: 100,
    });
    const matches: Square.Payment[] = [];
    for (let pages = 1; ; pages++) {
      matches.push(
        ...page.data.filter(
          (payment) =>
            payment.referenceId === String(order.orderNumber) &&
            Number(payment.amountMoney?.amount ?? -1) === order.totalCents
        )
      );
      if (!page.hasNextPage()) break;
      // Too many payments to read them all: we can't say there is none.
      if (pages >= MAX_PAGES) return matches.length > 0 ? pick(matches) : { kind: "unknown" };
      page = await page.getNextPage();
    }
    return matches.length > 0 ? pick(matches) : { kind: "none" };
  } catch (error) {
    console.error(
      "Pay: couldn't look up the payment in Square:",
      error instanceof Error ? error.name : "unknown error"
    );
    return { kind: "unknown" };
  }
}

/** One checkout ID makes at most one payment, but prefer one that took money. */
function pick(matches: Square.Payment[]): LookupResult {
  const tookMoney = ["COMPLETED", "APPROVED", "PENDING"];
  const best =
    matches.find((payment) => tookMoney.includes(payment.status ?? "")) ?? matches[matches.length - 1];
  return { kind: "found", payment: best };
}
