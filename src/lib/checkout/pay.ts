import "server-only";
import { after } from "next/server";
import type { Square } from "square";
import { alertOwnerLater } from "@/lib/alerts";
import { notifyOrderPaid } from "@/lib/orders/notify";
import { recordMarketingOptIn } from "@/lib/marketing-server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSquareClient, squareEnvironment, squareLocationId } from "@/lib/square";
import { getQuote, storeIsOpen, type Quote, type QuoteError } from "@/lib/checkout/quote";
import { findSquarePayment, readSquareFailure, type SquareFailure } from "@/lib/checkout/square-payment";
import type { PayInput } from "@/lib/checkout/schema";
import { saveTaxParts } from "@/lib/checkout/tax-parts";
import { formatPrice } from "@/lib/utils";

/**
 * Placing an order: save it, then charge the card through Square.
 *
 * 1. Work out the price again from the database. If it no longer matches the
 *    total the customer saw, charge nothing and send back the new price.
 * 2. Save the order and its jars as "pending_payment". The service role key
 *    writes them, because only checkout and the Square webhook may.
 * 3. Ask Square to take the money. The checkout ID is Square's idempotency
 *    key: if the same checkout is sent twice (a double click, or a retry
 *    after a lost connection), Square charges once and answers the same way.
 *    That works only if the second request matches the first, so the
 *    checkout page sends the same card code again and the request is built
 *    from the saved order.
 * 4. Mark the order "paid", with the card brand, last 4 digits and receipt
 *    link, or "payment_failed" with Square's reason.
 *
 * Each checkout ID makes at most one order. A retry with the same ID finds
 * that order again instead of making a second one, and first asks Square
 * whether the try before already took the money.
 *
 * When Square's answer doesn't say whether the card was charged (a lost
 * connection, a Square outage, a timeout), we ask Square for the payment.
 * If we still can't tell, the order stays "pending_payment" and the customer
 * is told not to pay again. The Square webhook has the final word.
 *
 * Failures that need Jesse (an order that couldn't be saved, a payment we
 * can't confirm, Square out of reach) also alert Jesse (src/lib/alerts.ts)
 * after the customer has their answer. Alerts name order numbers only.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");
/** A per-order alert goes out once: a week is as far back as the health check looks. */
const ONCE_PER_ORDER_HOURS = 7 * 24;

/** The version of the store terms the customer agrees to. Change it when /terms changes. */
export const TERMS_VERSION = "2026-10-28 (terms, refunds with classes, privacy)";

/** Statuses that mean the money was taken. */
const PAID_STATUSES = new Set([
  "paid",
  "ready_for_pickup",
  "out_for_delivery",
  "shipped",
  "fulfilled",
]);

export interface PaySuccess {
  ok: true;
  orderNumber: number;
  /** For the customer's order page link (online ordering step 5). */
  publicToken: string;
  totalCents: number;
  /** True when Square took the card but hasn't confirmed the money yet. */
  pending: boolean;
}

export type PayErrorCode =
  | QuoteError["code"]
  | "price_changed"
  | "payment_declined"
  | "payment_failed"
  | "payment_unavailable"
  | "payment_unconfirmed";

export interface PayError {
  ok: false;
  code: PayErrorCode;
  message: string;
  itemProblems?: QuoteError["itemProblems"];
  /** For price_changed: the new price to show. */
  quote?: Quote;
  /**
   * True when the customer may try again with the same checkout ID (we don't
   * know whether the card was charged, so Square must be asked again with
   * the same key). False when the next try needs a new checkout ID.
   */
  retrySameCheckout?: boolean;
}

export type PayResult = PaySuccess | PayError;

interface ExistingOrder {
  id: string;
  order_number: number;
  public_token: string;
  status: string;
  total_cents: number;
  customer_email: string;
  created_at: string;
  square_payment_id: string | null;
}

const ORDER_COLUMNS =
  "id, order_number, public_token, status, total_cents, customer_email, created_at, square_payment_id";

/** Square's decline codes, in words a customer can act on. */
export const DECLINE_MESSAGES: Record<string, string> = {
  CARD_DECLINED: "Your card was declined. Try another card, or call your bank.",
  GENERIC_DECLINE: "Your card was declined. Try another card, or call your bank.",
  INSUFFICIENT_FUNDS: "Your card was declined for low funds. Try another card.",
  CVV_FAILURE: "The security code (CVV) didn't match. Check it and try again.",
  ADDRESS_VERIFICATION_FAILURE: "The ZIP code didn't match your card. Check it and try again.",
  INVALID_EXPIRATION: "The expiration date isn't right. Check it and try again.",
  EXPIRATION_FAILURE: "The expiration date isn't right. Check it and try again.",
  INVALID_CARD: "That card number isn't valid. Check it and try again.",
  INVALID_ACCOUNT: "That card can't be used. Try another card.",
  CARD_NOT_SUPPORTED: "We can't take that kind of card. Try another card.",
  CARD_EXPIRED: "That card has expired. Try another card.",
  INVALID_PIN: "Your card was declined. Try another card.",
  TRANSACTION_LIMIT: "Your card was declined because of a spending limit. Try another card.",
  VOICE_FAILURE: "Your card was declined. Try another card, or call your bank.",
  ALLOWABLE_PIN_TRIES_EXCEEDED: "Your card was declined. Try another card.",
  CARD_TOKEN_EXPIRED: "The card form timed out. Enter your card again.",
  CARD_TOKEN_USED: "The card form timed out. Enter your card again.",
};

function fail(code: PayErrorCode, message: string, extra: Partial<PayError> = {}): PayError {
  return { ok: false, code, message, ...extra };
}

/** The order couldn't be saved, so the card was never sent to Square. */
const SAVE_FAILED = fail(
  "unavailable",
  "We couldn't save your order. Nothing was charged. Please try again in a few minutes.",
  { retrySameCheckout: false }
);

/** Square didn't answer, and has no payment for this order yet. A retry uses the same key. */
const SQUARE_UNREACHABLE = fail(
  "payment_unavailable",
  "We couldn't reach our payment service. Please wait a minute and try again. You won't be charged twice.",
  { retrySameCheckout: true }
);

/** We can't tell whether the card was charged. The order stays pending. */
function unconfirmed(order: ExistingOrder, reason: string): PayError {
  console.error(`Pay: couldn't confirm the payment for order #${order.order_number} (${reason}). It stays pending.`);
  alertOwnerLater({
    key: `pay:unconfirmed:${order.order_number}`,
    title: `Order #${order.order_number}: payment not confirmed`,
    message: `Checkout couldn't tell whether Square charged the card for order #${order.order_number} (${reason}). The customer was told not to pay again and that we'll email them. Look the payment up in Square, then email the customer.`,
    url: `${SITE_URL}/admin/orders/${order.id}`,
    windowHours: ONCE_PER_ORDER_HOURS,
  });
  return fail(
    "payment_unconfirmed",
    "We couldn't confirm your payment. Please don't pay again; we'll email you soon.",
    { retrySameCheckout: true }
  );
}

async function findOrder(checkoutId: string): Promise<ExistingOrder | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("checkout_id", checkoutId)
    .maybeSingle();
  if (error) throw new Error(`couldn't look up the order: ${error.message}`);
  return (data as ExistingOrder | null) ?? null;
}

/** Checkout is turning customers away because orders can't be saved. */
function alertSaveFailed(what: string, error: string) {
  alertOwnerLater({
    key: "pay:save-failed",
    title: "Checkout couldn't save an order",
    message: `Checkout couldn't save ${what} (${error}). No card was charged, and the customer was asked to try again in a few minutes. Until this is fixed, nobody can place an order.`,
    url: `${SITE_URL}/admin/orders`,
  });
}

/** Save a new order and its jars as pending_payment. Returns null if it couldn't. */
async function saveOrder(input: PayInput, quote: Quote): Promise<ExistingOrder | null> {
  const supabase = await createServiceClient();
  const f = quote.fulfillment;
  const geo = f.type === "pickup" ? null : f.geo;
  const address = input.fulfillment.type === "pickup" ? null : input.fulfillment.address;

  const { data, error } = await supabase
    .from("orders")
    .insert({
      checkout_id: input.checkoutId,
      status: "pending_payment",
      fulfillment_type: f.type,
      delivery_date: f.type === "local_delivery" ? f.deliveryDate : null,
      is_rush: f.type === "local_delivery" ? f.isRush : false,
      pickup_instructions: f.type === "pickup" ? f.instructions : null,

      customer_name: input.customer.name,
      customer_email: input.customer.email,
      customer_phone: input.customer.phone || null,
      customer_notes: input.customer.notes || null,
      address_line1: address?.line1 ?? null,
      address_line2: address?.line2 || null,
      city: address?.city ?? null,
      state: f.type === "shipping" ? f.state : (address?.state ?? null),
      postal_code: address?.postalCode ?? null,

      geo_matched_address: geo?.matchedAddress ?? null,
      geo_lat: geo?.lat ?? null,
      geo_lon: geo?.lon ?? null,
      geo_place_geoid: geo?.placeGeoid ?? null,
      geo_place_name: geo?.placeName ?? null,
      geo_county_fips: geo?.countyFips ?? null,
      delivery_miles: f.type === "local_delivery" ? f.miles : null,
      distance_method: f.type === "local_delivery" ? f.distanceMethod : null,

      subtotal_cents: quote.subtotalCents,
      delivery_fee_cents: quote.deliveryFeeCents,
      rush_fee_cents: quote.rushFeeCents,
      packing_fee_cents: quote.packingFeeCents,
      shipping_postage_cents: quote.postageCents,
      discount_cents: quote.discountCents,
      tax_cents: quote.taxCents,
      total_cents: quote.totalCents,
      tax_rate_bps: quote.tax.rateBps,
      tax_jurisdiction: quote.tax.jurisdiction,

      square_environment: squareEnvironment(),
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    })
    .select(ORDER_COLUMNS)
    .single();

  if (error || !data) {
    // Another request for the same checkout may have saved it a moment ago.
    if (error?.code === "23505") return findOrder(input.checkoutId);
    console.error("Pay: couldn't save the order:", error?.message ?? "no row");
    alertSaveFailed("a new order", error?.message ?? "no row came back");
    return null;
  }
  const order = data as ExistingOrder;

  const { error: itemsError } = await supabase.from("order_items").insert(
    quote.lines.map((line) => ({
      order_id: order.id,
      product_id: line.productId,
      product_name: line.name,
      product_size: line.size,
      unit_price_cents: line.unitPriceCents,
      quantity: line.qty,
      line_total_cents: line.lineTotalCents,
    }))
  );
  if (itemsError) {
    console.error("Pay: couldn't save the order's jars:", itemsError.message);
    alertSaveFailed(`the jars for order #${order.order_number}`, itemsError.message);
    // Nothing was charged yet, so take the half-saved order back out.
    await supabase.from("orders").delete().eq("id", order.id);
    return null;
  }
  await saveTaxParts(supabase, order.id, quote.taxParts);
  return order;
}

/**
 * Mark the discount code used by this order. Returns true, or the answer
 * for the customer when it can't. Then the unpaid order is taken back out,
 * since nothing was charged.
 */
async function claimDiscountCode(code: string, order: ExistingOrder): Promise<true | PayError> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("claim_discount_code", { p_code: code, p_order_id: order.id });
  if (!error && data === true) return true;
  if (error) {
    console.error("Pay: couldn't mark the discount code used:", error.message);
    alertSaveFailed(`the discount code for order #${order.order_number}`, error.message);
  }
  await supabase.from("orders").delete().eq("id", order.id).eq("status", "pending_payment");
  if (error) return SAVE_FAILED;
  return fail("bad_discount_code", "That discount code was just used on another order. Nothing was charged. Remove the code and get your price again.", {
    retrySameCheckout: false,
  });
}

/**
 * Update a pending order. Returns true if it changed. An order the webhook
 * has already marked is left alone, so it isn't marked (or emailed about)
 * twice.
 */
async function markOrder(order: ExistingOrder, fields: Record<string, unknown>): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update(fields)
    .eq("id", order.id)
    .eq("status", "pending_payment")
    .select("id");
  if (error) {
    console.error("Pay: couldn't update the order:", error.message);
    const step = fields.status === "paid" ? "paid" : fields.status === "payment_failed" ? "failed" : null;
    alertOwnerLater({
      key: `pay:update-failed:${order.order_number}`,
      title: `Order #${order.order_number}: couldn't save Square's answer`,
      message: `Square answered about order #${order.order_number}, but the site couldn't save it (${error.message}).${
        step === "paid" ? " Square took the money, but the order still shows as waiting on payment." : ""
      }${step === "failed" ? " The card was not charged, but the order still shows as waiting on payment." : ""} Check the payment in Square and the order in the admin.`,
      url: `${SITE_URL}/admin/orders/${order.id}`,
      windowHours: ONCE_PER_ORDER_HOURS,
    });
  }
  return !error && (data?.length ?? 0) > 0;
}

function success(order: ExistingOrder, pending: boolean): PaySuccess {
  return {
    ok: true,
    orderNumber: order.order_number,
    publicToken: order.public_token,
    totalCents: order.total_cents,
    pending,
  };
}

/** Where the request came from, kept as proof when the customer opts in to marketing emails. */
export interface PayContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Save the customer's marketing opt-in, after they have their answer. */
function keepOptIn(input: PayInput, orderId: string, context: PayContext) {
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

/** A declined card, as opposed to a request Square refused for another reason. */
export function isDecline(failure: { code: string; category: string }): boolean {
  return failure.code in DECLINE_MESSAGES || failure.category === "PAYMENT_METHOD_ERROR";
}

/**
 * Ask Square to take the money. Every field comes from the saved order or
 * stays the same, so a retry sends Square exactly the request it sent before.
 */
async function charge(
  saved: ExistingOrder,
  input: PayInput
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
      note: `Big Sexy's Brine Co. order #${saved.order_number}`,
    });
    return { ok: true, payment: response.payment };
  } catch (error) {
    return { ok: false, failure: readSquareFailure(error) };
  }
}

/** What Square needs to find this order's payment. */
function lookupFor(order: ExistingOrder) {
  return {
    paymentId: order.square_payment_id,
    orderNumber: order.order_number,
    totalCents: order.total_cents,
    createdAt: order.created_at,
    locationId: squareLocationId(),
  };
}

/** Save what Square said about the payment, and answer the customer. */
async function recordPayment(
  saved: ExistingOrder,
  payment: Square.Payment | undefined,
  input: PayInput,
  context: PayContext
): Promise<PayResult> {
  const card = payment?.cardDetails?.card;
  const details = {
    square_payment_id: payment?.id ?? null,
    square_order_id: payment?.orderId ?? null,
    square_receipt_url: payment?.receiptUrl ?? null,
    card_brand: card?.cardBrand ?? null,
    card_last4: card?.last4 ?? null,
    payment_error_code: null,
  };
  // The customer may have fixed their name or email before a retry. The
  // Square request keeps the first email, so it matches; the order and
  // receipt get the new one.
  const contact = {
    customer_name: input.customer.name,
    customer_email: input.customer.email,
    customer_phone: input.customer.phone || null,
    customer_notes: input.customer.notes || null,
  };

  if (payment?.status === "COMPLETED") {
    const marked = await markOrder(saved, {
      ...details,
      ...contact,
      status: "paid",
      paid_at: new Date().toISOString(),
    });
    // Tell Jesse and send the receipt after the customer has their answer.
    const orderId = saved.id;
    if (marked) after(() => notifyOrderPaid(orderId));
    keepOptIn(input, orderId, context);
    return success(saved, false);
  }
  if (payment?.status === "FAILED" || payment?.status === "CANCELED") {
    await markOrder(saved, { ...details, status: "payment_failed", payment_error_code: payment.status });
    return fail("payment_declined", "Your card was declined. Try another card.", {
      retrySameCheckout: false,
    });
  }
  // APPROVED or PENDING: Square has the card but hasn't settled it. The
  // webhook marks the order paid when Square confirms.
  await markOrder(saved, { ...details, ...contact });
  keepOptIn(input, saved.id, context);
  return success(saved, true);
}

export async function placeOrder(
  input: PayInput,
  context: PayContext = { ipAddress: null, userAgent: null }
): Promise<PayResult> {
  // A repeat of a checkout that already went through: answer the same way.
  const existing = await findOrder(input.checkoutId);
  if (existing && PAID_STATUSES.has(existing.status)) return success(existing, false);
  if (existing && existing.status === "payment_failed") {
    return fail("payment_failed", "That payment didn't go through. Please try again.", {
      retrySameCheckout: false,
    });
  }
  if (existing && existing.status !== "pending_payment") {
    // Cancelled, refunded or disputed: Jesse has already dealt with it.
    return fail("payment_failed", "This order is closed. Please contact us if you have questions.", {
      retrySameCheckout: false,
    });
  }

  let saved = existing;

  if (saved) {
    // A retry: the order is saved, and Square may already have the payment.
    // Look for it first, without working out the price again.
    const found = await findSquarePayment(getSquareClient(), lookupFor(saved));
    if (found.kind === "found") return recordPayment(saved, found.payment, input, context);
    // Not found, or the lookup failed. Sending the same key again can't
    // charge twice, but it may charge now, so the store must still be open.
    const open = await storeIsOpen();
    if (open === null) {
      return fail("unavailable", "Online ordering isn't working right now. Please try again in a few minutes.", {
        retrySameCheckout: true,
      });
    }
    if (!open) {
      return fail("store_closed", "Online ordering is closed right now. Please check back soon.", {
        retrySameCheckout: true,
      });
    }
  } else {
    // 1. The price, worked out again.
    const quote = await getQuote(input);
    if (!quote.ok) {
      return fail(quote.code, quote.message, {
        itemProblems: quote.itemProblems,
        retrySameCheckout: false,
      });
    }
    if (quote.totalCents !== input.expectedTotalCents) {
      return fail(
        "price_changed",
        `The price changed to ${formatPrice(quote.totalCents)} since you checked it. Nothing was charged. Look over the new total, then pay.`,
        { quote, retrySameCheckout: false }
      );
    }

    // 2. Save the order.
    saved = await saveOrder(input, quote);
    if (!saved) return SAVE_FAILED;

    // A discount code is used once. Mark it used by this order before the
    // card is charged; if another order got it first, charge nothing. A
    // failed payment frees the code again (a database trigger does that).
    if (input.discountCode && quote.discountCents > 0) {
      const claimed = await claimDiscountCode(input.discountCode, saved);
      if (claimed !== true) return claimed;
    }
  }

  // 3. Take the money.
  let attempt = await charge(saved, input);
  if (!attempt.ok && attempt.failure.kind === "unknown" && !attempt.failure.keyReused) {
    // No clear answer. Ask again with the same request after a moment:
    // Square answers with the first try's result, or charges now if the
    // first try never reached it. A decline is a clear answer; anything
    // else that isn't a payment leaves us where we were.
    console.error("Pay: no clear answer from Square, asking again:", attempt.failure.code);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const again = await charge(saved, input);
    if (again.ok || (again.failure.kind === "rejected" && isDecline(again.failure))) attempt = again;
  }

  if (!attempt.ok && attempt.failure.kind === "rejected") {
    // Square answered, and took no money.
    const failure = attempt.failure;
    await markOrder(saved, { status: "payment_failed", payment_error_code: failure.code });
    if (isDecline(failure)) {
      return fail("payment_declined", DECLINE_MESSAGES[failure.code] ?? "Your card was declined. Try another card.", {
        retrySameCheckout: false,
      });
    }
    console.error("Pay: Square refused the payment:", failure.code);
    alertOwnerLater({
      key: "pay:square-refused",
      title: "Square refused a payment",
      message: `Square turned down the payment for order #${saved.order_number} for a reason other than a declined card (${failure.code}). Nothing was charged, and the customer was asked to try again. If this keeps happening, check the Square settings.`,
      url: `${SITE_URL}/admin/orders/${saved.id}`,
    });
    return fail("payment_failed", "We couldn't take the payment. Nothing was charged. Please try again.", {
      retrySameCheckout: false,
    });
  }

  if (!attempt.ok) {
    // Still no clear answer. The card may or may not have been charged, so
    // look for the payment before saying anything, and leave the order
    // pending. Square's payment list can run a few seconds behind.
    const failure = attempt.failure;
    console.error("Pay: no clear answer from Square:", failure.code);
    const found = await findSquarePayment(getSquareClient(), lookupFor(saved));
    if (found.kind === "found") return recordPayment(saved, found.payment, input, context);
    // Nothing there yet. A retry with the same key and request is safe,
    // unless Square has already said the request doesn't match.
    const keyReused = failure.kind === "unknown" && failure.keyReused;
    if (found.kind === "none" && !keyReused) {
      alertOwnerLater({
        key: "pay:no-answer",
        title: "Checkout couldn't reach Square",
        message: `Square didn't answer for order #${saved.order_number} (${failure.code}), and has no payment for it yet. The customer was asked to wait a minute and try again. The order waits on payment until then.`,
        url: `${SITE_URL}/admin/orders/${saved.id}`,
      });
      return SQUARE_UNREACHABLE;
    }
    return unconfirmed(saved, failure.code);
  }

  // 4. Record the result.
  return recordPayment(saved, attempt.payment, input, context);
}
