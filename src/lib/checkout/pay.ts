import "server-only";
import { after } from "next/server";
import { SquareError } from "square";
import { notifyOrderPaid } from "@/lib/orders/notify";
import { recordMarketingOptIn } from "@/lib/marketing-server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSquareClient, squareEnvironment, squareLocationId } from "@/lib/square";
import { getQuote, type Quote, type QuoteError } from "@/lib/checkout/quote";
import type { PayInput } from "@/lib/checkout/schema";
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
 * 4. Mark the order "paid", with the card brand, last 4 digits and receipt
 *    link, or "payment_failed" with Square's reason.
 *
 * Each checkout ID makes at most one order. A retry with the same ID finds
 * that order again instead of making a second one.
 */

/** The version of the store terms the customer agrees to. Change it when /terms changes. */
export const TERMS_VERSION = "2026-10";

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
  | "payment_unavailable";

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
}

/** Square's decline codes, in words a customer can act on. */
const DECLINE_MESSAGES: Record<string, string> = {
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
  { retrySameCheckout: true }
);

async function findOrder(checkoutId: string): Promise<ExistingOrder | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, public_token, status, total_cents")
    .eq("checkout_id", checkoutId)
    .maybeSingle();
  if (error) throw new Error(`couldn't look up the order: ${error.message}`);
  return (data as ExistingOrder | null) ?? null;
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
    .select("id, order_number, public_token, status, total_cents")
    .single();

  if (error || !data) {
    // Another request for the same checkout may have saved it a moment ago.
    if (error?.code === "23505") return findOrder(input.checkoutId);
    console.error("Pay: couldn't save the order:", error?.message ?? "no row");
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
    // Nothing was charged yet, so take the half-saved order back out.
    await supabase.from("orders").delete().eq("id", order.id);
    return null;
  }
  return order;
}

async function markOrder(orderId: string, fields: Record<string, unknown>) {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("orders").update(fields).eq("id", orderId);
  if (error) console.error("Pay: couldn't update the order:", error.message);
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

  // A retry after a lost connection: the order is saved, and Square may
  // already have the payment. Ask Square again with the same key and amount,
  // without working out the price again.
  let saved = existing;

  if (!saved) {
    // 1. The price, worked out again.
    const quote = await getQuote(input);
    if (!quote.ok) {
      return fail(quote.code, quote.message, { itemProblems: quote.itemProblems });
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
  }

  // 3. Take the money.
  const locationId = squareLocationId();
  let payment;
  try {
    const response = await getSquareClient().payments.create({
      sourceId: input.sourceId,
      idempotencyKey: input.checkoutId,
      amountMoney: { amount: BigInt(saved.total_cents), currency: "USD" },
      ...(locationId ? { locationId } : {}),
      autocomplete: true,
      referenceId: String(saved.order_number),
      buyerEmailAddress: input.customer.email,
      note: `Big Sexy's Brine Co. order #${saved.order_number}`,
    });
    payment = response.payment;
  } catch (error) {
    if (error instanceof SquareError && error.errors.length > 0) {
      const code = String(error.errors[0].code);
      const declineMessage = DECLINE_MESSAGES[code];
      if (declineMessage || error.errors[0].category === "PAYMENT_METHOD_ERROR") {
        await markOrder(saved.id, { status: "payment_failed", payment_error_code: code });
        return fail("payment_declined", declineMessage ?? "Your card was declined. Try another card.", {
          retrySameCheckout: false,
        });
      }
      console.error("Pay: Square refused the payment:", code);
      await markOrder(saved.id, { status: "payment_failed", payment_error_code: code });
      return fail("payment_failed", "We couldn't take the payment. Nothing was charged. Please try again.", {
        retrySameCheckout: false,
      });
    }
    // No clear answer from Square (for example, a lost connection). The card
    // may or may not have been charged, so leave the order pending. Trying
    // again with the same checkout ID is safe: Square charges at most once.
    console.error(
      "Pay: no answer from Square:",
      error instanceof Error ? error.message : "unknown error"
    );
    return fail(
      "payment_unavailable",
      "We couldn't reach our payment service. Please wait a minute and try again. You won't be charged twice.",
      { retrySameCheckout: true }
    );
  }

  // 4. Record the result.
  const card = payment?.cardDetails?.card;
  const details = {
    square_payment_id: payment?.id ?? null,
    square_order_id: payment?.orderId ?? null,
    square_receipt_url: payment?.receiptUrl ?? null,
    card_brand: card?.cardBrand ?? null,
    card_last4: card?.last4 ?? null,
    payment_error_code: null,
  };

  if (payment?.status === "COMPLETED") {
    await markOrder(saved.id, { ...details, status: "paid", paid_at: new Date().toISOString() });
    // Tell Jesse and send the receipt after the customer has their answer.
    const orderId = saved.id;
    after(() => notifyOrderPaid(orderId));
    keepOptIn(input, orderId, context);
    return success(saved, false);
  }
  if (payment?.status === "FAILED" || payment?.status === "CANCELED") {
    await markOrder(saved.id, { ...details, status: "payment_failed", payment_error_code: payment.status });
    return fail("payment_declined", "Your card was declined. Try another card.", {
      retrySameCheckout: false,
    });
  }
  // APPROVED or PENDING: Square has the card but hasn't settled it. The
  // webhook marks the order paid when Square confirms.
  await markOrder(saved.id, details);
  keepOptIn(input, saved.id, context);
  return success(saved, true);
}
