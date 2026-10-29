/**
 * Class dates and times in words, always in Colorado time. Safe to use in
 * the browser and on the server.
 */

import { FULL_REFUND_DAYS } from "@/types/classes";

const TIME_ZONE = "America/Denver";

/** "Saturday, November 15" */
export function classDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** "10:00 AM" */
export function classTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** "Saturday, November 15, 10:00 AM to 2:00 PM" */
export function classWhen(startsAt: string, endsAt: string): string {
  return `${classDay(startsAt)}, ${classTime(startsAt)} to ${classTime(endsAt)}`;
}

/** "Saturday, November 15, 10:00 AM to 2:00 PM, The Karma House, 8402 W Colfax Ave" */
export function classWhenWhere(session: {
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string | null;
}): string {
  const place = [session.location_name, session.location_address].filter(Boolean).join(", ");
  return `${classWhen(session.starts_at, session.ends_at)}, ${place}`;
}

/** Whole days from `now` until the class starts, rounded down. */
export function daysUntilClass(startsAt: string, now = new Date()): number {
  return Math.floor((new Date(startsAt).getTime() - now.getTime()) / 86_400_000);
}

/** True when a cancel now gets a full refund under the class policy. */
export function refundDue(startsAt: string, now = new Date()): boolean {
  return new Date(startsAt).getTime() - now.getTime() >= FULL_REFUND_DAYS * 86_400_000;
}

/** The class refund policy, as customers see it on the class page, the booking form and emails. */
export const CLASS_POLICY_TEXT = `Need to cancel? Contact us at least ${FULL_REFUND_DAYS} days before class for a full refund. Inside ${FULL_REFUND_DAYS} days we can't refund, but you can send a friend in your place. If something serious comes up, get in touch and we'll see what we can do. If we cancel a class, you get a full refund.`;
