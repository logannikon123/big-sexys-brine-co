import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";
import { notifyOrderPaid } from "@/lib/orders/notify";

/**
 * What the site does with each message Square sends to the webhook
 * (src/app/api/square/webhook/route.ts).
 *
 * - payment.created / payment.updated: a payment finished or failed. A
 *   pending order becomes "paid" or "payment_failed". This catches the rare
 *   checkout where the card went through but the site lost Square's answer.
 * - refund.created / refund.updated: money went back to the customer. The
 *   order's refunded amount comes from Square's payment record, and the order
 *   becomes "refunded" (all of it) or "partially_refunded".
 * - dispute.created: the customer's bank is questioning the charge. The
 *   order becomes "disputed" so Jesse sees it.
 *
 * Every message is saved in square_webhook_events first. Square may send the
 * same message more than once; a message already handled is skipped.
 */

/** The parts of a Square payment the webhook reads. Square sends snake_case JSON. */
interface PaymentFields {
  id: string;
  status?: string;
  reference_id?: string;
  receipt_url?: string;
  order_id?: string;
  amount_money?: { amount?: number | string | bigint | null } | null;
  refunded_money?: { amount?: number | string | bigint | null } | null;
  card_details?: { card?: { card_brand?: string; last_4?: string } };
}

export interface SquareEvent {
  event_id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
}

interface OrderRow {
  id: string;
  status: string;
  total_cents: number;
}

/** Statuses a later payment message must not undo. */
const SETTLED = new Set([
  "paid",
  "ready_for_pickup",
  "out_for_delivery",
  "shipped",
  "fulfilled",
  "cancelled",
  "refunded",
  "partially_refunded",
  "disputed",
]);

async function db() {
  return createServiceClient();
}

/**
 * Find the order for a payment: by Square's payment ID, or else by our order
 * number (checkout puts it in the payment's reference ID). Square sends
 * messages for every payment on the account, market sales included, so a
 * match by number also needs the same amount and no other payment on file.
 */
async function findOrder(
  paymentId: string,
  referenceId?: string,
  amountCents?: number
): Promise<OrderRow | null> {
  const supabase = await db();
  const byPayment = await supabase
    .from("orders")
    .select("id, status, total_cents")
    .eq("square_payment_id", paymentId)
    .maybeSingle();
  if (byPayment.data) return byPayment.data as OrderRow;

  const orderNumber = Number(referenceId);
  if (!Number.isInteger(orderNumber) || orderNumber <= 0 || amountCents === undefined) return null;
  const byNumber = await supabase
    .from("orders")
    .select("id, status, total_cents, square_payment_id")
    .eq("order_number", orderNumber)
    .maybeSingle();
  const order = byNumber.data as (OrderRow & { square_payment_id: string | null }) | null;
  if (!order || order.square_payment_id !== null || order.total_cents !== amountCents) return null;
  return order;
}

async function updateOrder(id: string, fields: Record<string, unknown>) {
  const supabase = await db();
  const { error } = await supabase.from("orders").update(fields).eq("id", id);
  if (error) throw new Error(`couldn't update the order: ${error.message}`);
}

function cents(value: number | string | bigint | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

async function handlePayment(payment: PaymentFields) {
  const order = await findOrder(payment.id, payment.reference_id, cents(payment.amount_money?.amount));
  if (!order) return;

  const details = {
    square_payment_id: payment.id,
    square_order_id: payment.order_id ?? null,
    square_receipt_url: payment.receipt_url ?? null,
    card_brand: payment.card_details?.card?.card_brand ?? null,
    card_last4: payment.card_details?.card?.last_4 ?? null,
  };

  if (payment.status === "COMPLETED" && !SETTLED.has(order.status)) {
    await updateOrder(order.id, {
      ...details,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_error_code: null,
    });
    await notifyOrderPaid(order.id);
  } else if (
    (payment.status === "FAILED" || payment.status === "CANCELED") &&
    order.status === "pending_payment"
  ) {
    await updateOrder(order.id, {
      ...details,
      status: "payment_failed",
      payment_error_code: payment.status,
    });
  }

  // A payment message can also carry a new refunded total.
  const refunded = cents(payment.refunded_money?.amount);
  if (refunded > 0) await recordRefund(order, refunded);
}

async function recordRefund(order: OrderRow, refundedCents: number) {
  const refunded = Math.min(refundedCents, order.total_cents);
  await updateOrder(order.id, {
    refunded_cents: refunded,
    status: refunded >= order.total_cents ? "refunded" : "partially_refunded",
  });
}

/** Refund messages name the payment; Square's payment record has the refunded total. */
async function handleRefund(refund: { payment_id?: string; status?: string }) {
  if (!refund.payment_id || refund.status !== "COMPLETED") return;
  const { payment } = await getSquareClient().payments.get({ paymentId: refund.payment_id });
  if (!payment?.id) return;
  const order = await findOrder(payment.id, payment.referenceId, cents(payment.amountMoney?.amount));
  if (!order) return;
  const refunded = cents(payment.refundedMoney?.amount);
  if (refunded > 0) await recordRefund(order, refunded);
}

async function handleDispute(dispute: { disputed_payment?: { payment_id?: string } }) {
  const paymentId = dispute.disputed_payment?.payment_id;
  if (!paymentId) return;
  const order = await findOrder(paymentId);
  if (!order || order.status === "refunded") return;
  await updateOrder(order.id, { status: "disputed" });
}

/**
 * Save the message, handle it once, and mark it handled. Throws if the
 * database can't be reached, so the route answers with an error and Square
 * sends the message again later.
 */
export async function handleSquareEvent(event: SquareEvent): Promise<"handled" | "duplicate" | "ignored"> {
  const supabase = await db();

  // Only the ID and type are kept. Square also sends messages about market
  // sales, and there's no reason to store those customers' payment details.
  const { error: insertError } = await supabase.from("square_webhook_events").insert({
    event_id: event.event_id,
    event_type: event.type,
  });
  if (insertError) {
    if (insertError.code !== "23505") {
      throw new Error(`couldn't save the webhook message: ${insertError.message}`);
    }
    // Seen before. Skip it if it was handled; try again if it wasn't.
    const { data } = await supabase
      .from("square_webhook_events")
      .select("processed_at")
      .eq("event_id", event.event_id)
      .maybeSingle();
    if (data?.processed_at) return "duplicate";
  }

  const object = event.data?.object ?? {};
  let result: "handled" | "ignored" = "handled";
  switch (event.type) {
    case "payment.created":
    case "payment.updated":
      if (object.payment) await handlePayment(object.payment as PaymentFields);
      break;
    case "refund.created":
    case "refund.updated":
      if (object.refund) await handleRefund(object.refund as { payment_id?: string; status?: string });
      break;
    case "dispute.created":
      if (object.dispute) await handleDispute(object.dispute as { disputed_payment?: { payment_id?: string } });
      break;
    default:
      result = "ignored";
  }

  await supabase
    .from("square_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", event.event_id);
  return result;
}
