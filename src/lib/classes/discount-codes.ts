import "server-only";
import { randomInt } from "node:crypto";
import { alertOwner } from "@/lib/alerts";
import { createServiceClient } from "@/lib/supabase/server";
import { classDay } from "@/lib/classes/format";
import { CLASS_DISCOUNT_MONTHS, CLASS_DISCOUNT_PERCENT } from "@/types/classes";

/**
 * The "10% off your first order" perk for class guests. Each day the cron
 * route (src/app/api/cron/class-discount-codes) calls sendClassDiscountCodes:
 *
 * 1. Find bookings whose class ended in the last LOOK_BACK_DAYS days, that
 *    were paid on Square's live system, aren't cancelled and weren't
 *    refunded in full.
 * 2. Give each one a one-time code (one per booking, enforced by the
 *    database), good for CLASS_DISCOUNT_MONTHS months.
 * 3. Email the code to the customer, once. emailed_at marks it sent; a
 *    failed send is tried again the next day.
 *
 * Test bookings (Square sandbox) never get a code, so testing can't hand
 * out real discounts.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");
const FROM = "Big Sexy's Brine Co. <noreply@bigsexysbrine.co>";
/** Classes that ended longer ago than this are left alone, so a long outage doesn't email old guests. */
const LOOK_BACK_DAYS = 14;
/** No 0, O, 1 or I, so a code read aloud or typed from paper comes out right. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** "CLASS-7KQ2M-9XA4T": 10 random characters, about 50 bits, too many to guess. */
export function newDiscountCode(): string {
  const pick = () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `CLASS-${pick()}-${pick()}`;
}

interface BookingRow {
  id: string;
  orders: {
    order_number: number;
    status: string;
    refund_status: string;
    customer_name: string;
    customer_email: string;
    square_environment: string | null;
  } | null;
  class_sessions: { starts_at: string; ends_at: string } | null;
  discount_codes: { id: number; code: string; expires_at: string; emailed_at: string | null } | null;
}

export interface CodeRunResult {
  /** Bookings that should have a code. */
  due: number;
  created: number;
  emailed: number;
  failed: number;
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

/** Make the booking's code, or read the one it already has. */
async function codeFor(booking: BookingRow, now: Date): Promise<BookingRow["discount_codes"]> {
  if (booking.discount_codes) return booking.discount_codes;
  const supabase = await createServiceClient();
  // Two tries, in case a new code matches an old one.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from("discount_codes")
      .insert({
        code: newDiscountCode(),
        percent_off: CLASS_DISCOUNT_PERCENT,
        class_booking_id: booking.id,
        valid_from: now.toISOString(),
        expires_at: addMonths(now, CLASS_DISCOUNT_MONTHS).toISOString(),
      })
      .select("id, code, expires_at, emailed_at")
      .single();
    if (!error && data) return data;
    if (error?.code !== "23505") throw new Error(`couldn't save a discount code: ${error?.message ?? "no row"}`);
    // The booking got its code in another run, or the code was taken.
    const existing = await supabase
      .from("discount_codes")
      .select("id, code, expires_at, emailed_at")
      .eq("class_booking_id", booking.id)
      .maybeSingle();
    if (existing.data) return existing.data;
  }
  throw new Error("couldn't make a discount code that isn't taken");
}

export function discountEmailText(name: string, code: string, classStartsAt: string, expiresAt: string): string {
  const until = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  }).format(new Date(expiresAt));
  return [
    `Hi ${name},`,
    "",
    `Thanks for coming to Learn to Preserve on ${classDay(classStartsAt)}. We hope your jars turn out great.`,
    "",
    `As promised, here's ${CLASS_DISCOUNT_PERCENT}% off the jars in one online order:`,
    "",
    `    ${code}`,
    "",
    `Enter it in the Discount code box at checkout on ${SITE_URL}/products. It works once, until ${until}, and takes ${CLASS_DISCOUNT_PERCENT}% off the jars (not delivery, shipping or tax).`,
    "",
    "Questions? Reply to this email.",
    "",
    "Big Sexy's Brine Co.",
  ].join("\n");
}

async function sendCodeEmail(booking: BookingRow, code: NonNullable<BookingRow["discount_codes"]>): Promise<string | null> {
  if (!process.env.RESEND_API_KEY) return "RESEND_API_KEY is not set";
  const order = booking.orders!;
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const alertTo = process.env.ORDER_ALERT_EMAIL;
  const result = await resend.emails.send({
    from: FROM,
    to: order.customer_email,
    ...(alertTo ? { replyTo: alertTo } : {}),
    subject: `Your ${CLASS_DISCOUNT_PERCENT}% off code from Big Sexy's Brine Co.`,
    text: discountEmailText(order.customer_name, code.code, booking.class_sessions!.starts_at, code.expires_at),
  });
  return result.error ? result.error.message : null;
}

/** True when a booking has earned its code. */
export function earnsCode(booking: BookingRow): boolean {
  const order = booking.orders;
  return (
    !!order &&
    !!booking.class_sessions &&
    order.square_environment === "production" &&
    (order.status === "paid" || order.status === "fulfilled") &&
    order.refund_status !== "full"
  );
}

export async function sendClassDiscountCodes(now = new Date(), dryRun = false): Promise<CodeRunResult> {
  const supabase = await createServiceClient();
  const since = new Date(now.getTime() - LOOK_BACK_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("class_bookings")
    .select(
      "id, orders!inner(order_number, status, refund_status, customer_name, customer_email, square_environment), class_sessions!inner(starts_at, ends_at), discount_codes(id, code, expires_at, emailed_at)"
    )
    .is("cancelled_at", null)
    .lt("class_sessions.ends_at", now.toISOString())
    .gte("class_sessions.ends_at", since);
  if (error) throw new Error(`couldn't read class bookings: ${error.message}`);

  const due = ((data ?? []) as unknown as BookingRow[]).filter(
    (booking) => earnsCode(booking) && !booking.discount_codes?.emailed_at
  );
  const result: CodeRunResult = { due: due.length, created: 0, emailed: 0, failed: 0 };
  if (dryRun) return result;

  const failures: string[] = [];
  for (const booking of due) {
    const number = booking.orders!.order_number;
    try {
      const hadCode = !!booking.discount_codes;
      const code = await codeFor(booking, now);
      if (!code) throw new Error("no code came back");
      if (!hadCode) result.created += 1;
      const problem = await sendCodeEmail(booking, code);
      if (problem) throw new Error(`the email didn't go out (${problem})`);
      await supabase.from("discount_codes").update({ emailed_at: new Date().toISOString() }).eq("id", code.id);
      result.emailed += 1;
    } catch (err) {
      result.failed += 1;
      const reason = err instanceof Error ? err.message : "unknown error";
      console.error(`Class discount code for booking #${number} failed:`, reason);
      failures.push(`#${number}: ${reason}`);
    }
  }

  if (failures.length > 0) {
    await alertOwner({
      key: "class:discount-codes",
      title: "Class discount codes didn't all go out",
      message: `${failures.length} class ${failures.length === 1 ? "guest" : "guests"} didn't get their ${CLASS_DISCOUNT_PERCENT}% off code. The site tries again tomorrow. ${failures.slice(0, 5).join("; ")}`,
      url: `${SITE_URL}/admin/classes`,
      windowHours: 20,
    });
  }
  return result;
}
