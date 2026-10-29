import "server-only";
import { after } from "next/server";
import type { Square } from "square";
import { alertOwner, alertOwnerLater } from "@/lib/alerts";
import { notifyOrderPaid } from "@/lib/orders/notify";
import { recordMarketingOptIn } from "@/lib/marketing-server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSquareClient, squareEnvironment, squareLocationId } from "@/lib/square";
import { DECLINE_MESSAGES, isDecline, type PayContext } from "@/lib/checkout/pay";
import { findSquarePayment, readSquareFailure, type SquareFailure } from "@/lib/checkout/square-payment";
import type { BookClassInput } from "@/lib/classes/schema";
import { formatPrice } from "@/lib/utils";

/**
 * Booking class seats: hold the seats, then charge the card through Square.
 * The same steps as jar checkout (src/lib/checkout/pay.ts), with the seats
 * in place of the price check:
 *
 * 1. book_class_seats (a database function) locks the session, checks the
 *    seats and price, and saves the order and booking as "pending_payment"
 *    in one step. Two people booking the last seat at once can't both get
 *    it: the second waits for the first, then finds the session full, and
 *    their card is never sent to Square.
 * 2. Square takes the money, with the checkout ID as its idempotency key, so
 *    a double click or retry charges once.
 * 3. The order becomes "paid" or "payment_failed". A failed payment frees
 *    the seats by itself: seats count only for orders waiting on payment or
 *    paid.
 *
 * When Square's answer doesn't say whether the card was charged, we ask
 * Square for the payment. If we still can't tell, the booking stays pending
 * and holds its seats, the customer is told not to pay again, Jesse gets an
 * alert, and the Square webhook has the final word.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");
const ONCE_PER_ORDER_HOURS = 7 * 24;

/** The version of the terms a class customer agrees to. Change it when /terms, /refunds or the class policy changes. */
export const CLASS_TERMS_VERSION = "2026-10-28 (terms, class policy, privacy)";

const PAID_STATUSES = new Set(["paid", "fulfilled"]);

export interface BookSuccess {
  ok: true;
  orderNumber: number;
  publicToken: string;
  totalCents: number;
  /** True when Square took the card but hasn't confirmed the money yet. */
  pending: boolean;
}

export type BookErrorCode =
  | "not_found"
  | "closed"
  | "bad_seats"
  | "full"
  | "price_changed"
  | "unavailable"
  | "payment_declined"
  | "payment_failed"
  | "payment_unavailable"
  | "payment_unconfirmed";

export interface BookError {
  ok: false;
  code: BookErrorCode;
  message: string;
  /** For "full": seats still free. For "price_changed": the new price per seat. */
  seatsLeft?: number;
  priceCents?: number;
  /** True when the customer may try again with the same checkout ID. */
  retrySameCheckout?: boolean;
}

export type BookResult = BookSuccess | BookError;

interface SavedOrder {
  id: string;
  order_number: number;
  public_token: string;
  status: string;
  total_cents: number;
  customer_email: string;
  created_at: string;
  square_payment_id: string | null;
}

type SeatAnswer =
  | { status: "booked" | "existing"; order: SavedOrder }
  | { status: "not_found" | "closed" | "bad_seats" }
  | { status: "full"; seats_left: number }
  | { status: "price_changed"; price_cents: number };

function fail(code: BookErrorCode, message: string, extra: Partial<BookError> = {}): BookError {
  return { ok: false, code, message, ...extra };
}

function success(order: SavedOrder, pending: boolean): BookSuccess {
  return {
    ok: true,
    orderNumber: order.order_number,
    publicToken: order.public_token,
    totalCents: order.total_cents,
    pending,
  };
}

const SAVE_FAILED = fail(
  "unavailable",
  "We couldn't save your booking. Nothing was charged. Please try again in a few minutes.",
  { retrySameCheckout: false }
);

const SQUARE_UNREACHABLE = fail(
  "payment_unavailable",
  "We couldn't reach our payment service. Please wait a minute and try again. You won't be charged twice.",
  { retrySameCheckout: true }
);

/** Hold the seats and save the order, or find the one this checkout saved before. */
async function holdSeats(input: BookClassInput): Promise<SeatAnswer | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("book_class_seats", {
    p_checkout_id: input.checkoutId,
    p_session_id: input.sessionId,
    p_seats: input.seats,
    p_expected_total_cents: input.expectedTotalCents,
    p_customer_name: input.customer.name,
    p_customer_email: input.customer.email,
    p_customer_phone: input.customer.phone,
    p_customer_notes: input.customer.notes ?? "",
    p_square_environment: squareEnvironment(),
    p_terms_version: CLASS_TERMS_VERSION,
  });
  if (error || !data) {
    console.error("Class booking: couldn't save the booking:", error?.message ?? "no answer");
    alertOwnerLater({
      key: "class:save-failed",
      title: "Class booking couldn't save a booking",
      message: `The class booking form couldn't save a booking (${error?.message ?? "no answer"}). No card was charged, and the customer was asked to try again in a few minutes. Until this is fixed, nobody can book.`,
      url: `${SITE_URL}/admin/classes`,
    });
    return null;
  }
  return data as SeatAnswer;
}

/** Update a pending order. Returns true if it changed (the webhook may have got there first). */
async function markOrder(order: SavedOrder, fields: Record<string, unknown>): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update(fields)
    .eq("id", order.id)
    .eq("status", "pending_payment")
    .select("id");
  if (error) {
    console.error("Class booking: couldn't update the order:", error.message);
    alertOwnerLater({
      key: `class:update-failed:${order.order_number}`,
      title: `Class booking #${order.order_number}: couldn't save Square's answer`,
      message: `Square answered about class booking #${order.order_number}, but the site couldn't save it (${error.message}). Check the payment in Square and the order in the admin.`,
      url: `${SITE_URL}/admin/orders/${order.id}`,
      windowHours: ONCE_PER_ORDER_HOURS,
    });
  }
  return !error && (data?.length ?? 0) > 0;
}

function unconfirmed(order: SavedOrder, reason: string): BookError {
  console.error(`Class booking: couldn't confirm the payment for #${order.order_number} (${reason}). It stays pending.`);
  alertOwnerLater({
    key: `class:unconfirmed:${order.order_number}`,
    title: `Class booking #${order.order_number}: payment not confirmed`,
    message: `The booking form couldn't tell whether Square charged the card for class booking #${order.order_number} (${reason}). The seats stay held. The customer was told not to pay again and that we'll email them. Look the payment up in Square, then email the customer.`,
    url: `${SITE_URL}/admin/orders/${order.id}`,
    windowHours: ONCE_PER_ORDER_HOURS,
  });
  return fail(
    "payment_unconfirmed",
    "We couldn't confirm your payment. Please don't pay again; we'll email you soon.",
    { retrySameCheckout: true }
  );
}

/**
 * Square took the money, but the order had already left "pending_payment".
 * Usually the webhook marked it paid first. If Jesse cancelled the booking
 * while the payment was still going through, the card was charged for seats
 * that are no longer held, so tell him to refund it.
 */
async function checkChargedAfterCancel(order: SavedOrder) {
  const supabase = await createServiceClient();
  const { data } = await supabase.from("orders").select("status").eq("id", order.id).maybeSingle();
  if (data?.status !== "cancelled") return;
  await alertOwner({
    key: `class:charged-after-cancel:${order.order_number}`,
    title: `Class booking #${order.order_number}: charged after you cancelled`,
    message: `Square charged the card for class booking #${order.order_number}, but the booking was cancelled while the payment was going through. Refund it in Square, or book the customer in again.`,
    url: `${SITE_URL}/admin/orders/${order.id}`,
    windowHours: ONCE_PER_ORDER_HOURS,
  });
}

function keepOptIn(input: BookClassInput, orderId: string, context: PayContext) {
  if (!input.marketingOptIn) return;
  after(() =>
    recordMarketingOptIn({
      email: input.customer.email,
      name: input.customer.name,
      source: "checkout",
      orderId,
      ...context,
    })
  );
}

/** Ask Square to take the money. Every field comes from the saved order, so a retry sends the same request. */
async function charge(
  saved: SavedOrder,
  input: BookClassInput
): Promise<{ ok: true; payment?: Square.Payment } | { ok: false; failure: SquareFailure }> {
  const locationId = squareLocationId();
  try {
    const response = await getSquareClient().payments.create({
      sourceId: input.sourceId,
      idempotencyKey: input.checkoutId,
      amountMoney: { amount: BigInt(saved.total_cents), currency: "USD" },
      ...(locationId ? { locationId } : {}),
      autocomplete: true,
      referenceId: String(saved.order_number),
      buyerEmailAddress: saved.customer_email,
      note: `Big Sexy's Brine Co. class booking #${saved.order_number}`,
    });
    return { ok: true, payment: response.payment };
  } catch (error) {
    return { ok: false, failure: readSquareFailure(error) };
  }
}

function lookupFor(order: SavedOrder) {
  return {
    paymentId: order.square_payment_id,
    orderNumber: order.order_number,
    totalCents: order.total_cents,
    createdAt: order.created_at,
    locationId: squareLocationId(),
  };
}

async function recordPayment(
  saved: SavedOrder,
  payment: Square.Payment | undefined,
  input: BookClassInput,
  context: PayContext
): Promise<BookResult> {
  const card = payment?.cardDetails?.card;
  const details = {
    square_payment_id: payment?.id ?? null,
    square_order_id: payment?.orderId ?? null,
    square_receipt_url: payment?.receiptUrl ?? null,
    card_brand: card?.cardBrand ?? null,
    card_last4: card?.last4 ?? null,
    payment_error_code: null,
  };
  const contact = {
    customer_name: input.customer.name,
    customer_email: input.customer.email,
    customer_phone: input.customer.phone,
    customer_notes: input.customer.notes || null,
  };

  if (payment?.status === "COMPLETED") {
    const marked = await markOrder(saved, {
      ...details,
      ...contact,
      status: "paid",
      paid_at: new Date().toISOString(),
    });
    const orderId = saved.id;
    if (marked) after(() => notifyOrderPaid(orderId));
    else after(() => checkChargedAfterCancel(saved));
    keepOptIn(input, orderId, context);
    return success(saved, false);
  }
  if (payment?.status === "FAILED" || payment?.status === "CANCELED") {
    await markOrder(saved, { ...details, status: "payment_failed", payment_error_code: payment.status });
    return fail("payment_declined", "Your card was declined. Try another card.", { retrySameCheckout: false });
  }
  // APPROVED or PENDING: the webhook marks the order paid when Square confirms.
  await markOrder(saved, { ...details, ...contact });
  keepOptIn(input, saved.id, context);
  return success(saved, true);
}

export async function bookClass(
  input: BookClassInput,
  context: PayContext = { ipAddress: null, userAgent: null }
): Promise<BookResult> {
  const answer = await holdSeats(input);
  if (!answer) return SAVE_FAILED;

  switch (answer.status) {
    case "not_found":
      return fail("not_found", "That class date isn't available. Pick another date.");
    case "closed":
      return fail("closed", "Booking for that class has closed. Pick another date, or contact us.");
    case "bad_seats":
      return fail("bad_seats", "One booking can take 1 to 4 seats.");
    case "full":
      return fail(
        "full",
        answer.seats_left > 0
          ? `Only ${answer.seats_left} ${answer.seats_left === 1 ? "seat is" : "seats are"} left. Nothing was charged. Pick fewer seats or another date.`
          : "That class just filled up. Nothing was charged. Pick another date.",
        { seatsLeft: answer.seats_left, retrySameCheckout: false }
      );
    case "price_changed":
      return fail(
        "price_changed",
        `The price changed to ${formatPrice(answer.price_cents)} a seat. Nothing was charged. Look over the new total, then book.`,
        { priceCents: answer.price_cents, retrySameCheckout: false }
      );
  }

  const saved = answer.order;
  if (answer.status === "existing") {
    if (PAID_STATUSES.has(saved.status)) return success(saved, false);
    if (saved.status === "payment_failed") {
      return fail("payment_failed", "That payment didn't go through. Please try again.", { retrySameCheckout: false });
    }
    if (saved.status !== "pending_payment") {
      return fail("payment_failed", "This booking is closed. Please contact us if you have questions.", {
        retrySameCheckout: false,
      });
    }
    // A retry of a pending booking: Square may already have the payment.
    const found = await findSquarePayment(getSquareClient(), lookupFor(saved));
    if (found.kind === "found") return recordPayment(saved, found.payment, input, context);
  }

  let attempt = await charge(saved, input);
  if (!attempt.ok && attempt.failure.kind === "unknown" && !attempt.failure.keyReused) {
    console.error("Class booking: no clear answer from Square, asking again:", attempt.failure.code);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const again = await charge(saved, input);
    if (again.ok || (again.failure.kind === "rejected" && isDecline(again.failure))) attempt = again;
  }

  if (!attempt.ok && attempt.failure.kind === "rejected") {
    const failure = attempt.failure;
    await markOrder(saved, { status: "payment_failed", payment_error_code: failure.code });
    if (isDecline(failure)) {
      return fail("payment_declined", DECLINE_MESSAGES[failure.code] ?? "Your card was declined. Try another card.", {
        retrySameCheckout: false,
      });
    }
    console.error("Class booking: Square refused the payment:", failure.code);
    alertOwnerLater({
      key: "class:square-refused",
      title: "Square refused a class payment",
      message: `Square turned down the payment for class booking #${saved.order_number} for a reason other than a declined card (${failure.code}). Nothing was charged, and the customer was asked to try again. If this keeps happening, check the Square settings.`,
      url: `${SITE_URL}/admin/orders/${saved.id}`,
    });
    return fail("payment_failed", "We couldn't take the payment. Nothing was charged. Please try again.", {
      retrySameCheckout: false,
    });
  }

  if (!attempt.ok) {
    const failure = attempt.failure;
    console.error("Class booking: no clear answer from Square:", failure.code);
    const found = await findSquarePayment(getSquareClient(), lookupFor(saved));
    if (found.kind === "found") return recordPayment(saved, found.payment, input, context);
    const keyReused = failure.kind === "unknown" && failure.keyReused;
    if (found.kind === "none" && !keyReused) {
      alertOwnerLater({
        key: "class:no-answer",
        title: "Class booking couldn't reach Square",
        message: `Square didn't answer for class booking #${saved.order_number} (${failure.code}), and has no payment for it yet. The seats stay held, and the customer was asked to wait a minute and try again.`,
        url: `${SITE_URL}/admin/orders/${saved.id}`,
      });
      return SQUARE_UNREACHABLE;
    }
    return unconfirmed(saved, failure.code);
  }

  return recordPayment(saved, attempt.payment, input, context);
}
