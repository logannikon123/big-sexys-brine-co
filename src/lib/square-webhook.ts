import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getSquareClient } from "@/lib/square";
import { notifyOrderPaid, notifyOrderRefund } from "@/lib/orders/notify";
import {
  planSquareChange,
  refundSplit,
  type PaymentPlan,
  type SquareChange,
} from "@/lib/orders/payment-state";
import type { Order } from "@/types/orders";

/**
 * What the site does with each message Square sends to the webhook
 * (src/app/api/square/webhook/route.ts). The rules for what changes live in
 * src/lib/orders/payment-state.ts.
 *
 * - payment.created / payment.updated: a payment finished or failed. A
 *   pending order becomes "paid" or "payment_failed". This catches the rare
 *   checkout where the card went through but the site lost Square's answer.
 *   The step changes only if the order is still where it was when read, so
 *   the webhook and checkout never both mark (or announce) the same order.
 * - refund.created / refund.updated: money went back to the customer. Each
 *   refund is saved in order_refunds, the order's refunded amount comes from
 *   Square's payment record, and the customer gets an email. The order's
 *   step stays as it was, so Jesse can still finish a partly refunded order.
 * - dispute.created / dispute.state.updated: the customer's bank is
 *   questioning the charge, or has decided. The order's dispute_status
 *   becomes "open", "won" or "lost", and its step stays as it was.
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

interface RefundFields {
  id?: string;
  status?: string;
  payment_id?: string;
  reason?: string;
  created_at?: string;
  amount_money?: { amount?: number | string | bigint | null } | null;
}

interface DisputeFields {
  id?: string;
  dispute_id?: string;
  state?: string;
  disputed_payment?: { payment_id?: string };
}

export interface SquareEvent {
  event_id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
}

const ORDER_COLUMNS =
  "id, status, total_cents, refunded_cents, dispute_status, disputed_at, square_payment_id, subtotal_cents, delivery_fee_cents, rush_fee_cents, packing_fee_cents, shipping_postage_cents, discount_cents, tax_cents";

type OrderRow = Pick<
  Order,
  | "id"
  | "status"
  | "total_cents"
  | "refunded_cents"
  | "dispute_status"
  | "disputed_at"
  | "square_payment_id"
  | "subtotal_cents"
  | "delivery_fee_cents"
  | "rush_fee_cents"
  | "packing_fee_cents"
  | "shipping_postage_cents"
  | "discount_cents"
  | "tax_cents"
>;

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
    .select(ORDER_COLUMNS)
    .eq("square_payment_id", paymentId)
    .maybeSingle();
  if (byPayment.data) return byPayment.data as OrderRow;

  const orderNumber = Number(referenceId);
  if (!Number.isInteger(orderNumber) || orderNumber <= 0 || amountCents === undefined) return null;
  const byNumber = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("order_number", orderNumber)
    .maybeSingle();
  const order = byNumber.data as OrderRow | null;
  if (!order || order.square_payment_id !== null || order.total_cents !== amountCents) return null;
  return order;
}

async function updateOrder(id: string, fields: Record<string, unknown>) {
  if (Object.keys(fields).length === 0) return;
  const supabase = await db();
  const { error } = await supabase.from("orders").update(fields).eq("id", id);
  if (error) throw new Error(`couldn't update the order: ${error.message}`);
}

/**
 * Save a change of step only if the order is still at the step we read.
 * Checkout also marks pending orders (and leaves alone any order that isn't
 * pending), so whichever gets there first wins. Returns false when the
 * order had moved on and nothing was saved.
 */
async function updateOrderFrom(
  id: string,
  fromStatus: OrderRow["status"],
  fields: Record<string, unknown>
): Promise<boolean> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("orders")
    .update(fields)
    .eq("id", id)
    .eq("status", fromStatus)
    .select("id");
  if (error) throw new Error(`couldn't update the order: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

function cents(value: number | string | bigint | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** The plan's refund and dispute fields, plus the times that go with them. */
function planFields(order: OrderRow, plan: PaymentPlan): Record<string, unknown> {
  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {};
  if (plan.refunded_cents !== undefined) fields.refunded_cents = plan.refunded_cents;
  if (plan.dispute_status) {
    fields.dispute_status = plan.dispute_status;
    if (!order.disputed_at) fields.disputed_at = now;
    if (plan.dispute_status !== "open") fields.dispute_closed_at = now;
  }
  return fields;
}

async function handlePayment(payment: PaymentFields, secondTry = false): Promise<void> {
  const order = await findOrder(payment.id, payment.reference_id, cents(payment.amount_money?.amount));
  if (!order) return;

  const plan = planSquareChange(order, {
    kind: "payment",
    paymentStatus: payment.status,
    refundedCents: cents(payment.refunded_money?.amount),
  } satisfies SquareChange);
  const fields = planFields(order, plan);

  if (!plan.status) {
    await updateOrder(order.id, fields);
    return;
  }

  Object.assign(fields, {
    square_payment_id: payment.id,
    square_order_id: payment.order_id ?? null,
    square_receipt_url: payment.receipt_url ?? null,
    card_brand: payment.card_details?.card?.card_brand ?? null,
    card_last4: payment.card_details?.card?.last_4 ?? null,
    status: plan.status,
    ...(plan.status === "paid"
      ? { paid_at: new Date().toISOString(), payment_error_code: null }
      : { payment_error_code: payment.status }),
  });

  if (await updateOrderFrom(order.id, order.status, fields)) {
    if (plan.announcePaid) await notifyOrderPaid(order.id);
    return;
  }
  // Checkout changed the step while this message was being read. Read the
  // order again and decide once more. If it moves again, fail, and Square
  // sends the message later.
  if (secondTry) throw new Error("the order kept changing while the payment was saved");
  await handlePayment(payment, true);
}

/**
 * Refund messages name the payment; Square's payment record has the
 * refunded total. Each refund is saved by its own id, so a later message
 * about the same refund updates its row instead of adding one.
 */
async function handleRefund(refund: RefundFields) {
  if (!refund.id || !refund.payment_id) return;
  const { payment } = await getSquareClient().payments.get({ paymentId: refund.payment_id });
  if (!payment?.id) return;
  const order = await findOrder(payment.id, payment.referenceId, cents(payment.amountMoney?.amount));
  if (!order) return;

  const amount = cents(refund.amount_money?.amount);
  const supabase = await db();
  const { error } = await supabase.from("order_refunds").upsert(
    {
      order_id: order.id,
      square_refund_id: refund.id,
      square_payment_id: payment.id,
      amount_cents: amount,
      status: refund.status ?? "PENDING",
      reason: refund.reason ?? null,
      // The split goes in only when it is certain. Otherwise it is left out,
      // so a later message about the same refund keeps the split Jesse gave
      // on the admin order page (new rows start with it empty).
      ...refundSplit(order, amount),
      refunded_at: refund.created_at ?? new Date().toISOString(),
    },
    { onConflict: "square_refund_id" }
  );
  if (error) throw new Error(`couldn't save the refund: ${error.message}`);

  const plan = planSquareChange(order, {
    kind: "refund",
    refundStatus: refund.status,
    refundedCents: cents(payment.refundedMoney?.amount),
  });
  await updateOrder(order.id, planFields(order, plan));
  if (plan.emailRefund) await notifyOrderRefund(order.id, refund.id, amount);
}

async function handleDispute(dispute: DisputeFields) {
  const paymentId = dispute.disputed_payment?.payment_id;
  if (!paymentId) return;
  const order = await findOrder(paymentId);
  if (!order) return;
  const plan = planSquareChange(order, { kind: "dispute", disputeState: dispute.state });
  const fields = planFields(order, plan);
  const disputeId = dispute.id ?? dispute.dispute_id;
  if (disputeId) fields.square_dispute_id = disputeId;
  await updateOrder(order.id, fields);
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
      if (object.refund) await handleRefund(object.refund as RefundFields);
      break;
    case "dispute.created":
    case "dispute.state.updated":
    case "dispute.state.changed":
      if (object.dispute) await handleDispute(object.dispute as DisputeFields);
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
