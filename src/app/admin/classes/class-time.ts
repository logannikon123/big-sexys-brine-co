/**
 * Turning a date and time typed in the admin into a moment the database can
 * store, and back. Jesse types class times in Colorado time, and the
 * database keeps one exact moment (a timestamptz).
 *
 * Colorado moves its clocks twice a year, so the gap from UTC is 6 hours in
 * summer and 7 in winter. We read the gap for that day from the time zone
 * tables built into JavaScript, rather than guessing it, so a class in March
 * or November lands at the hour Jesse typed. No date library needed.
 *
 * Safe to use in the browser and on the server.
 */

const TIME_ZONE = "America/Denver";

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const PARTS_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The Colorado date ("2026-11-15") and time ("10:00") of a moment. */
export function denverDateTime(ms: number): { date: string; time: string } {
  const parts: Record<string, string> = {};
  for (const p of PARTS_FORMAT.formatToParts(new Date(ms))) parts[p.type] = p.value;
  // Some older browsers write midnight as "24".
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

/** How far Colorado's clock is from UTC at a moment, in ms (minus 6 or 7 hours). */
function denverOffset(ms: number): number {
  const { date, time } = denverDateTime(ms);
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wholeMinute = Math.floor(ms / 60_000) * 60_000;
  return Date.UTC(y, m - 1, d, h, min) - wholeMinute;
}

/**
 * The exact moment for a Colorado date and time, as an ISO string, or null
 * when there is no such moment: a bad date like Feb 30, or a time in the
 * hour skipped when clocks go forward in March. In the hour that happens
 * twice in November, it picks the first.
 */
export function denverToIso(date: string, time: string): string | null {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  // The typed clock reading, as if it were UTC.
  const wall = Date.UTC(y, m - 1, d, h, min);
  // Take off the gap, then check the gap again at the moment found, in case
  // the clocks changed in between.
  let moment = wall - denverOffset(wall);
  moment = wall - denverOffset(moment);
  const back = denverDateTime(moment);
  if (back.date !== date || back.time !== time) return null;
  return new Date(moment).toISOString();
}

/** A stored moment as the date and time the admin form shows. */
export function isoToDenverInputs(iso: string): { date: string; time: string } {
  return denverDateTime(new Date(iso).getTime());
}
