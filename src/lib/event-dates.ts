/**
 * Event dates, read as calendar days in Colorado.
 *
 * The events table stores dates like "2027-06-01" with no time. Passing one
 * to new Date() reads it as midnight in London (UTC), which is still the
 * evening before in Colorado, so the site showed some events a day early and
 * moved them to "Past" the evening before they ran. These helpers never turn
 * the date into a moment in time: they print the day as written, and compare
 * it with today's date in Colorado.
 *
 * Safe to use in the browser too.
 */

import { storeDate } from "@/lib/checkout/dates";

/**
 * Print a date-only string, like "2027-06-01", in words. Pass the parts to
 * show, as for toLocaleDateString. The server and the browser always print
 * the same day, whatever their time zone.
 */
export function formatEventDay(date: string, options: Intl.DateTimeFormatOptions): string {
  // Midnight UTC shown in UTC is the same calendar day as written.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

/** The year, month (1 to 12) and day of a date-only string. */
export function eventDayParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

/**
 * True while an event still counts as upcoming: through the whole of its last
 * day (or its only day) in Colorado. The Find Us page, the home page, the home
 * banner and the admin dashboard all use this rule.
 */
export function isEventUpcoming(
  event: { date: string; end_date?: string | null },
  now: Date
): boolean {
  return (event.end_date ?? event.date) >= storeDate(now);
}
