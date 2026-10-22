"use server";

/**
 * What the admin order pages can change. The database lets admins change
 * only the status, the notes, the tracking details and the step times, so
 * the money and the customer's details stay as checkout saved them.
 *
 * Each action returns { error } with a plain message when something expected
 * goes wrong, so Jesse sees what happened instead of a crash.
 *
 * Admins may also say what a part refund was for (saveRefundFor), which
 * fills in that refund's jars, fees and tax for the tax report.
 *
 * A step that has a customer email (ready, out for delivery, shipped,
 * delivered, cancelled) sends it after the step is saved. The email never
 * holds up or undoes the step: see notifyOrderStep in src/lib/orders/notify.ts.
 */

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthAction } from "@/lib/supabase/auth-guard";
import {
  MOVE_TIMESTAMP,
  TRACKING_CARRIERS,
  canMove,
  statusLabel,
} from "@/components/admin/orders/order-flow";
import type {
  FulfillmentType,
  OrderAdminUpdate,
  OrderStatus,
} from "@/types/orders";
import { notifyOrderStep } from "@/lib/orders/notify";
import { splitRefund, type RefundFor } from "@/lib/tax-split";
import { isOrderId } from "./order-data";

type ActionResult = { error?: string };

const NOT_FOUND = "That order wasn't found. Go back to the order list and try again.";
const NOT_SAVED =
  "Nothing was saved. The order may have changed, or this account can't change orders. Reload the page and try again.";

const NOTE_MAX = 2000;
const TRACKING_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{3,39}$/;

function revalidateOrder(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
}

export async function updateOrderStatus(
  id: string,
  nextStatus: OrderStatus
): Promise<ActionResult> {
  await requireAuthAction();
  if (!isOrderId(id)) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data: order, error: loadError } = await supabase
    .from("orders")
    .select("id, status, fulfillment_type, tracking_number")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!order) return { error: NOT_FOUND };

  const current = order.status as OrderStatus;
  const type = order.fulfillment_type as FulfillmentType;

  if (!canMove(type, current, nextStatus)) {
    return {
      error: `This order is "${statusLabel(current)}", so it can't be marked "${statusLabel(nextStatus)}". Reload the page to see where it stands.`,
    };
  }
  if (nextStatus === "shipped" && !order.tracking_number?.trim()) {
    return { error: "Save a tracking number before you mark this order shipped." };
  }

  const update: OrderAdminUpdate = {
    status: nextStatus,
    [MOVE_TIMESTAMP[nextStatus]]: new Date().toISOString(),
  };

  // Only change the order if its step is still the one checked above. If it
  // changed in the meantime (Jesse on another phone, say), nothing is saved.
  const { data: saved, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .eq("status", current)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) return { error: NOT_SAVED };

  revalidateOrder(id);
  // Email the customer once Jesse has his answer.
  after(() => notifyOrderStep(id, nextStatus));
  return {};
}

export async function saveTracking(
  id: string,
  number: string,
  carrier: string
): Promise<ActionResult> {
  await requireAuthAction();
  if (!isOrderId(id)) return { error: NOT_FOUND };

  const trackingNumber = number.trim().toUpperCase();
  const trackingCarrier = carrier.trim();
  if (!trackingNumber) return { error: "Type the tracking number first." };
  if (!TRACKING_PATTERN.test(trackingNumber)) {
    return {
      error:
        "That tracking number doesn't look right. Use only letters, numbers, spaces and dashes (4 to 40 characters).",
    };
  }
  if (!(TRACKING_CARRIERS as readonly string[]).includes(trackingCarrier)) {
    return { error: "Pick a carrier from the list." };
  }

  const supabase = await createClient();
  const { data: order, error: loadError } = await supabase
    .from("orders")
    .select("id, fulfillment_type")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!order) return { error: NOT_FOUND };
  if (order.fulfillment_type !== "shipping") {
    return { error: "Only shipped orders have a tracking number." };
  }

  const update: OrderAdminUpdate = {
    tracking_number: trackingNumber,
    tracking_carrier: trackingCarrier,
  };
  const { data: saved, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) return { error: NOT_SAVED };

  revalidateOrder(id);
  return {};
}

export async function saveAdminNote(
  id: string,
  note: string
): Promise<ActionResult> {
  await requireAuthAction();
  if (!isOrderId(id)) return { error: NOT_FOUND };

  const trimmed = note.trim();
  if (trimmed.length > NOTE_MAX) {
    return {
      error: `Notes can be up to ${NOTE_MAX} characters. This one has ${trimmed.length}.`,
    };
  }

  const supabase = await createClient();
  const update: OrderAdminUpdate = { admin_notes: trimmed || null };
  const { data: saved, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) return { error: NOT_FOUND };

  revalidateOrder(id);
  return {};
}

const REFUND_CHOICES: readonly RefundFor[] = ["fees", "jars", "both", "unsure"];
const REFUND_NOT_FOUND =
  "That refund wasn't found. Reload the page and try again.";

/**
 * Save what a part refund was for, and the jars, fees and tax that follow
 * from it. jarsCents is the jar price Jesse typed, used only for "both".
 *
 * The tax is the order's rate on the jar part, rounded as checkout rounds
 * (src/lib/tax-split.ts). The answer must fit the order: across all its
 * refunds, no more jars, fees or tax can go back than the customer paid.
 */
export async function saveRefundFor(
  refundId: number,
  refundFor: RefundFor,
  jarsCents: number | null
): Promise<ActionResult> {
  await requireAuthAction();
  if (!Number.isSafeInteger(refundId) || refundId <= 0) return { error: REFUND_NOT_FOUND };
  if (!REFUND_CHOICES.includes(refundFor)) return { error: "Pick one of the choices." };

  const supabase = await createClient();
  const { data: refund, error: refundError } = await supabase
    .from("order_refunds")
    .select("id, order_id, amount_cents, status, refund_for, jars_cents")
    .eq("id", refundId)
    .maybeSingle();
  if (refundError) return { error: refundError.message };
  if (!refund) return { error: REFUND_NOT_FOUND };
  if (refund.refund_for === null && refund.jars_cents !== null) {
    return { error: "This refund was the whole order, so its split is already known." };
  }
  if (refund.status === "REJECTED" || refund.status === "FAILED") {
    return { error: "This refund didn't go through, so there's nothing to split." };
  }

  const [orderResult, othersResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, subtotal_cents, tax_cents, tax_rate_bps, delivery_fee_cents, rush_fee_cents, packing_fee_cents, shipping_postage_cents"
      )
      .eq("id", refund.order_id)
      .maybeSingle(),
    supabase
      .from("order_refunds")
      .select("jars_cents, fees_cents, tax_cents")
      .eq("order_id", refund.order_id)
      .neq("id", refundId)
      .in("status", ["COMPLETED", "PENDING"])
      .not("jars_cents", "is", null),
  ]);
  if (orderResult.error) return { error: orderResult.error.message };
  if (othersResult.error) return { error: othersResult.error.message };
  const order = orderResult.data;
  if (!order) return { error: NOT_FOUND };

  let split = null;
  if (refundFor !== "unsure") {
    // An order that paid no tax gets none back.
    const rate = order.tax_cents > 0 ? (order.tax_rate_bps ?? 0) : 0;
    split = splitRefund(refund.amount_cents, rate, refundFor, jarsCents ?? 0);
    if (!split) {
      return {
        error:
          refundFor === "both"
            ? "Type the jar price, more than $0. The jars and their tax can't add up to more than the refund."
            : "Pick one of the choices.",
      };
    }

    const others = othersResult.data ?? [];
    const sum = (key: "jars_cents" | "fees_cents" | "tax_cents") =>
      others.reduce((total, r) => total + (r[key] ?? 0), 0);
    const fees =
      order.delivery_fee_cents +
      order.rush_fee_cents +
      order.packing_fee_cents +
      order.shipping_postage_cents;
    if (sum("jars_cents") + split.jarsCents > order.subtotal_cents) {
      return {
        error:
          "That's more jars than this order had, counting its other refunds. If the refund also covered a fee, pick Some of each.",
      };
    }
    if (sum("fees_cents") + split.feesCents > fees) {
      return {
        error:
          "That's more in fees than this order had, counting its other refunds. If the refund covered jars, pick Jars only or Some of each.",
      };
    }
    if (sum("tax_cents") + split.taxCents > order.tax_cents) {
      return {
        error: "That would give back more tax than the order paid. Check the jar price.",
      };
    }
  }

  const { data: saved, error } = await supabase
    .from("order_refunds")
    .update({
      refund_for: refundFor,
      jars_cents: split?.jarsCents ?? null,
      fees_cents: split?.feesCents ?? null,
      tax_cents: split?.taxCents ?? null,
    })
    .eq("id", refundId)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) return { error: NOT_SAVED };

  revalidateOrder(refund.order_id);
  revalidatePath("/admin/sales/tax");
  return {};
}
