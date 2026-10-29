"use server";

/**
 * What the Class sessions admin page can change: add, edit, hide and delete
 * class dates, and cancel a booking with or without a refund.
 *
 * Every action checks for a signed-in admin first, then works with that
 * admin's rights, so the database rules still apply. Each returns { error }
 * with a plain message when something expected goes wrong, so Jesse sees
 * what happened instead of a crash.
 *
 * Cancelling a booking:
 * 1. A full refund is due 7 or more days before class. Inside that, the
 *    site refunds only when Jesse ticks "special case".
 * 2. The refund goes to Square first. If Square says no, nothing is
 *    cancelled, so the seats and the money never disagree.
 * 3. Then the booking is marked cancelled (which frees its seats) and its
 *    order moves to "cancelled".
 * 4. The customer gets the cancelled email. The Square webhook records the
 *    refund and sends the refund email when the money moves.
 */

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthAction } from "@/lib/supabase/auth-guard";
import { getSquareClient } from "@/lib/square";
import { readSquareFailure } from "@/lib/checkout/square-payment";
import { notifyOrderStep } from "@/lib/orders/notify";
import { refundDue } from "@/lib/classes/format";
import { formatPrice } from "@/lib/utils";
import { FULL_REFUND_DAYS } from "@/types/classes";
import type { OrderAdminUpdate, OrderStatus } from "@/types/orders";
import { isOrderId } from "@/app/admin/orders/order-data";
import {
  ADDRESS_MAX,
  CANCEL_NOTE_MAX,
  NAME_MAX,
  PRICE_MAX_CENTS,
  PRICE_MIN_CENTS,
  SEATS_MAX,
  SEATS_MIN,
} from "@/components/admin/classes/class-rows";
import { denverToIso } from "./class-time";

export type ClassActionResult = { error?: string; message?: string };

/** What the add and edit forms send. Times are Colorado time. */
export interface ClassSessionInput {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  startTime: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  seats: number;
  /** Dollars per seat, as typed. */
  price: string;
  isPublished: boolean;
}


const SESSION_NOT_FOUND = "That class date wasn't found. Reload the page and try again.";
const BOOKING_NOT_FOUND = "That booking wasn't found. Reload the page and try again.";

function revalidateClasses(orderId?: string) {
  revalidatePath("/admin/classes");
  revalidatePath("/learn-to-preserve");
  if (orderId) {
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin");
  }
}

function isSessionId(id: unknown): id is number {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0;
}

type SessionRow = {
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string | null;
  seats: number;
  price_cents: number;
  is_published: boolean;
};

/** Checks the form and turns it into a row, or says what to fix. */
function readSessionInput(input: ClassSessionInput): { row: SessionRow } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Fill in the form first." };
  const date = String(input.date ?? "");
  const startTime = String(input.startTime ?? "");
  const endTime = String(input.endTime ?? "");
  if (!date) return { error: "Pick the class date." };
  if (!startTime || !endTime) return { error: "Pick a start time and an end time." };

  const startsAt = denverToIso(date, startTime);
  const endsAt = denverToIso(date, endTime);
  if (!startsAt || !endsAt) {
    return {
      error:
        "That date or time doesn't exist in Colorado. (On the day clocks go forward, 2:00 to 2:59 AM is skipped.)",
    };
  }
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { error: "The end time must be after the start time." };
  }

  const locationName = String(input.locationName ?? "").trim();
  const locationAddress = String(input.locationAddress ?? "").trim();
  if (!locationName) return { error: "Type the name of the place." };
  if (locationName.length > NAME_MAX) {
    return { error: `The place name can be up to ${NAME_MAX} characters.` };
  }
  if (locationAddress.length > ADDRESS_MAX) {
    return { error: `The address can be up to ${ADDRESS_MAX} characters.` };
  }

  const seats = Number(input.seats);
  if (!Number.isInteger(seats) || seats < SEATS_MIN || seats > SEATS_MAX) {
    return { error: `Seats must be a whole number from ${SEATS_MIN} to ${SEATS_MAX}.` };
  }

  const dollars = Number(String(input.price ?? "").replace(/[$,\s]/g, ""));
  const priceCents = Math.round(dollars * 100);
  if (!Number.isFinite(dollars) || priceCents < PRICE_MIN_CENTS || priceCents > PRICE_MAX_CENTS) {
    return {
      error: `The price must be from ${formatPrice(PRICE_MIN_CENTS)} to ${formatPrice(PRICE_MAX_CENTS)} a seat.`,
    };
  }

  return {
    row: {
      starts_at: startsAt,
      ends_at: endsAt,
      location_name: locationName,
      location_address: locationAddress || null,
      seats,
      price_cents: priceCents,
      is_published: input.isPublished !== false,
    },
  };
}

export async function createClassSession(input: ClassSessionInput): Promise<ClassActionResult> {
  await requireAuthAction();
  const read = readSessionInput(input);
  if ("error" in read) return { error: read.error };
  if (new Date(read.row.starts_at).getTime() <= Date.now()) {
    return { error: "That date and time has already passed. Pick a time still to come." };
  }

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("class_sessions")
    .insert(read.row)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) {
    return { error: "Nothing was saved. This account may not be able to add class dates." };
  }

  revalidateClasses();
  return {
    message: read.row.is_published
      ? "Class date added. It shows on the class page now."
      : "Class date added. It stays hidden until you show it.",
  };
}

export async function updateClassSession(
  id: number,
  input: ClassSessionInput
): Promise<ClassActionResult> {
  await requireAuthAction();
  if (!isSessionId(id)) return { error: SESSION_NOT_FOUND };
  const read = readSessionInput(input);
  if ("error" in read) return { error: read.error };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("class_sessions")
    .update(read.row)
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) return { error: SESSION_NOT_FOUND };

  revalidateClasses();
  return { message: "Class date saved." };
}

export async function setClassSessionPublished(
  id: number,
  published: boolean
): Promise<ClassActionResult> {
  await requireAuthAction();
  if (!isSessionId(id)) return { error: SESSION_NOT_FOUND };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("class_sessions")
    .update({ is_published: published === true })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) return { error: SESSION_NOT_FOUND };

  revalidateClasses();
  return {
    message: published
      ? "This class date shows on the class page again."
      : "This class date is hidden. Nobody new can book it. Bookings already made stay.",
  };
}

const HAS_BOOKINGS =
  "This class date has bookings, so it can't be deleted. Hide it instead, and cancel the bookings if the class isn't going ahead.";

export async function deleteClassSession(id: number): Promise<ClassActionResult> {
  await requireAuthAction();
  if (!isSessionId(id)) return { error: SESSION_NOT_FOUND };

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("class_bookings")
    .select("id", { count: "exact", head: true })
    .eq("session_id", id);
  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) return { error: HAS_BOOKINGS };

  const { data: deleted, error } = await supabase
    .from("class_sessions")
    .delete()
    .eq("id", id)
    .select("id");
  // 23503: a booking arrived after the count above, and the database kept the date.
  if (error) return { error: error.code === "23503" ? HAS_BOOKINGS : error.message };
  if (!deleted || deleted.length === 0) return { error: SESSION_NOT_FOUND };

  revalidateClasses();
  return { message: "Class date deleted." };
}

export interface CancelBookingOptions {
  /** Give the money back through Square. */
  refund: boolean;
  /** Jesse allows a refund inside the no-refund window (an emergency, say). */
  specialCase: boolean;
  /** Why, for Jesse's records. Saved on the booking, never sent to the customer. */
  note: string;
}

/** Order steps that move to "cancelled" with the booking. */
const CANCELLABLE_STATUSES: readonly OrderStatus[] = ["paid", "pending_payment"];

export async function cancelClassBooking(
  bookingId: string,
  options: CancelBookingOptions
): Promise<ClassActionResult> {
  await requireAuthAction();
  if (typeof bookingId !== "string" || !isOrderId(bookingId)) return { error: BOOKING_NOT_FOUND };

  const wantsRefund = options?.refund === true;
  const specialCase = options?.specialCase === true;
  const note = String(options?.note ?? "").trim();
  if (note.length > CANCEL_NOTE_MAX) {
    return { error: `The note can be up to ${CANCEL_NOTE_MAX} characters. This one has ${note.length}.` };
  }

  const supabase = await createClient();
  const { data: booking, error: bookingError } = await supabase
    .from("class_bookings")
    .select("id, order_id, session_id, cancelled_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) return { error: bookingError.message };
  if (!booking) return { error: BOOKING_NOT_FOUND };
  if (booking.cancelled_at) return { error: "This booking is already cancelled." };

  const [orderResult, sessionResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, total_cents, refunded_cents, square_payment_id")
      .eq("id", booking.order_id)
      .maybeSingle(),
    supabase
      .from("class_sessions")
      .select("id, starts_at")
      .eq("id", booking.session_id)
      .maybeSingle(),
  ]);
  if (orderResult.error) return { error: orderResult.error.message };
  if (sessionResult.error) return { error: sessionResult.error.message };
  const order = orderResult.data;
  const session = sessionResult.data;
  if (!order || !session) return { error: BOOKING_NOT_FOUND };

  const status = order.status as OrderStatus;
  if (wantsRefund && !refundDue(session.starts_at) && !specialCase) {
    return {
      error: `The class is less than ${FULL_REFUND_DAYS} days away, so no refund is due. Tick "Special case" to refund anyway, or untick the refund.`,
    };
  }

  // Step 1: the refund, before anything changes here.
  let refundedCents = 0;
  let refundNote = "No money was given back.";
  if (wantsRefund) {
    const tookPayment = status !== "pending_payment" && status !== "payment_failed";
    const left = order.total_cents - order.refunded_cents;
    if (!tookPayment) {
      refundNote = "The customer never paid, so there was nothing to refund.";
    } else if (left <= 0) {
      refundNote = "The order was already refunded in full.";
    } else if (!order.square_payment_id) {
      return {
        error: `Order #${order.order_number} has no Square payment on file, so the site can't refund it. Nothing was cancelled. Refund it in your Square Dashboard, then cancel here with the refund unticked.`,
      };
    } else {
      try {
        const response = await getSquareClient().refunds.refundPayment({
          // The same booking always sends the same key, so a retry can't refund twice.
          idempotencyKey: `cancel-${booking.id}`,
          paymentId: order.square_payment_id,
          amountMoney: { amount: BigInt(left), currency: "USD" },
          reason: "Class booking cancelled",
        });
        const refundStatus = response.refund?.status;
        if (response.errors?.length || refundStatus === "REJECTED" || refundStatus === "FAILED") {
          console.error("Class refund refused by Square:", response.errors?.[0]?.code ?? refundStatus);
          return {
            error: `Square refused the refund for order #${order.order_number}. Nothing was cancelled. Check the payment in your Square Dashboard.`,
          };
        }
      } catch (error) {
        const failure = readSquareFailure(error);
        console.error("Class refund failed:", failure.code);
        return {
          error:
            failure.kind === "rejected"
              ? `Square refused the refund for order #${order.order_number} (${failure.code}). Nothing was cancelled. Check the payment in your Square Dashboard.`
              : `Square didn't answer clearly, so the refund for order #${order.order_number} may or may not have gone through. Nothing was cancelled here. Check the payment in your Square Dashboard. It is safe to try again: Square won't refund this booking twice.`,
        };
      }
      refundedCents = left;
      refundNote = `Square is sending ${formatPrice(left)} back to the customer's card. The order shows the refund once Square confirms it.`;
    }
  }

  // Step 2: cancel the booking, which frees its seats.
  const now = new Date().toISOString();
  const { data: cancelled, error: cancelError } = await supabase
    .from("class_bookings")
    .update({ cancelled_at: now, cancel_note: note || null })
    .eq("id", booking.id)
    .is("cancelled_at", null)
    .select("id");
  if (cancelError || !cancelled || cancelled.length === 0) {
    if (cancelError) console.error("Cancelling a class booking failed:", cancelError.message);
    return {
      error:
        refundedCents > 0
          ? `Square is refunding ${formatPrice(refundedCents)}, but the booking wasn't marked cancelled. Reload the page and cancel it again with the refund unticked.`
          : "Nothing was cancelled. The booking may have changed, or this account can't cancel bookings. Reload the page and try again.",
    };
  }

  // Step 3: the order follows the booking.
  let orderNote = "";
  if (CANCELLABLE_STATUSES.includes(status)) {
    const update: OrderAdminUpdate = { status: "cancelled", cancelled_at: now };
    const { data: saved, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order.id)
      .eq("status", status)
      .select("id");
    if (error || !saved || saved.length === 0) {
      if (error) console.error("Cancelling a class order failed:", error.message);
      orderNote = ` The booking is cancelled, but order #${order.order_number} didn't move to Cancelled. Open the order and check it.`;
    } else if (status === "paid") {
      // Only a customer who paid hears about it. Never holds up the cancel.
      after(() => notifyOrderStep(order.id, "cancelled"));
      orderNote = " The customer gets an email saying the booking is cancelled.";
    }
  }

  revalidateClasses(order.id);
  return { message: `Booking cancelled and its seats are free. ${refundNote}${orderNote}` };
}
