/**
 * Loads class sessions and their bookings for the admin pages. Server code
 * only. Reads with the signed-in admin's rights: the database lets only
 * admins see these tables.
 */

import { createClient } from "@/lib/supabase/server";
import type { ClassSession } from "@/types/classes";
import type { OrderStatus, RefundStatus, SquareEnvironment } from "@/types/orders";
import {
  holdsSeats,
  type AdminClassBooking,
  type AdminClassSession,
} from "@/components/admin/classes/class-rows";

const LOAD_ERROR =
  "The class sessions didn't load. Reload the page. If it keeps happening, tell Nick.";

const BOOKING_COLUMNS =
  "id, order_id, session_id, seats, cancelled_at, cancel_note, created_at, orders(id, order_number, status, customer_name, customer_email, customer_phone, total_cents, refunded_cents, refund_status, square_environment, square_payment_id)";

interface BookingQueryRow {
  id: string;
  order_id: string;
  session_id: number;
  seats: number;
  cancelled_at: string | null;
  cancel_note: string | null;
  created_at: string;
  orders: {
    id: string;
    order_number: number;
    status: OrderStatus;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    total_cents: number;
    refunded_cents: number;
    refund_status: RefundStatus;
    square_environment: SquareEnvironment | null;
    square_payment_id: string | null;
  } | null;
}

/** Keeps Square's payment ID on the server: the page needs only to know there is one. */
function toBooking(row: BookingQueryRow): AdminClassBooking {
  const { orders, ...booking } = row;
  if (!orders) return { ...booking, order: null };
  const { square_payment_id, ...order } = orders;
  return { ...booking, order: { ...order, has_payment: Boolean(square_payment_id) } };
}

export interface ClassSessionsResult {
  /** Not over yet, soonest first. A class under way counts. */
  upcoming: AdminClassSession[];
  /** Over, most recent first. */
  past: AdminClassSession[];
  /** The price on the Class Info page, in cents, for new sessions. */
  defaultPriceCents: number;
  error: string | null;
}

/** class_info.price is dollars, and may arrive as a string. */
function dollarsToCents(value: unknown): number {
  const dollars = Number(value);
  return Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
}

export async function loadClassSessions(): Promise<ClassSessionsResult> {
  const supabase = await createClient();
  const [sessionsResult, bookingsResult, infoResult] = await Promise.all([
    supabase.from("class_sessions").select("*").order("starts_at", { ascending: true }),
    supabase
      .from("class_bookings")
      .select(BOOKING_COLUMNS)
      .order("created_at", { ascending: false }),
    supabase.from("class_info").select("price").eq("id", 1).maybeSingle(),
  ]);

  const defaultPriceCents = dollarsToCents(infoResult.data?.price);
  const failed = [sessionsResult, bookingsResult].find((r) => r.error);
  if (failed?.error) {
    console.error("Loading class sessions failed:", failed.error.message);
    return { upcoming: [], past: [], defaultPriceCents, error: LOAD_ERROR };
  }

  const bookings = ((bookingsResult.data ?? []) as unknown as BookingQueryRow[]).map(toBooking);
  const bySession = new Map<number, AdminClassBooking[]>();
  for (const booking of bookings) {
    const list = bySession.get(booking.session_id) ?? [];
    list.push(booking);
    bySession.set(booking.session_id, list);
  }

  const sessions: AdminClassSession[] = ((sessionsResult.data ?? []) as ClassSession[]).map(
    (session) => {
      const own = bySession.get(session.id) ?? [];
      return {
        ...session,
        bookings: own,
        seatsTaken: own.filter(holdsSeats).reduce((sum, b) => sum + b.seats, 0),
      };
    }
  );

  const now = Date.now();
  const isOver = (s: AdminClassSession) => new Date(s.ends_at).getTime() <= now;
  return {
    upcoming: sessions.filter((s) => !isOver(s)),
    past: sessions.filter(isOver).reverse(),
    defaultPriceCents,
    error: null,
  };
}

/** The class booking behind an order, for the admin order page. */
export interface OrderClassBooking {
  seats: number;
  cancelled_at: string | null;
  cancel_note: string | null;
  session: Pick<
    ClassSession,
    "id" | "starts_at" | "ends_at" | "location_name" | "location_address"
  > | null;
}

/** Null when the order has no class booking. */
export async function loadClassBookingForOrder(orderId: string): Promise<OrderClassBooking | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_bookings")
    .select(
      "seats, cancelled_at, cancel_note, class_sessions(id, starts_at, ends_at, location_name, location_address)"
    )
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) {
    console.error("Loading an order's class booking failed:", error.message);
    return null;
  }
  if (!data) return null;
  const { class_sessions, ...booking } = data as unknown as Omit<OrderClassBooking, "session"> & {
    class_sessions: OrderClassBooking["session"];
  };
  return { ...booking, session: class_sessions ?? null };
}
