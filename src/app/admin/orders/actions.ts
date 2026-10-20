"use server";

/**
 * What the admin order pages can change. The database lets admins change
 * only the status, the notes, the tracking details and the step times, so
 * the money and the customer's details stay as checkout saved them.
 *
 * Each action returns { error } with a plain message when something expected
 * goes wrong, so Jesse sees what happened instead of a crash.
 */

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
      error: `This order is "${statusLabel(current, type)}", so it can't be marked "${statusLabel(nextStatus, type)}". Reload the page to see where it stands.`,
    };
  }
  if (nextStatus === "shipped" && !order.tracking_number?.trim()) {
    return { error: "Save a tracking number before you mark this order shipped." };
  }

  const update: OrderAdminUpdate = {
    status: nextStatus,
    [MOVE_TIMESTAMP[nextStatus]]: new Date().toISOString(),
  };

  // Only change the order if its status is still the one checked above. If
  // Square changed it in the meantime (a refund, say), nothing is saved.
  const { data: saved, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .eq("status", current)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) return { error: NOT_SAVED };

  revalidateOrder(id);
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
