/**
 * The dates on the tax report, read from and written to the address:
 *   ?period=2026-10                       one month
 *   ?period=2026-Q3                       one quarter
 *   ?period=custom&from=2026-10-01&to=2026-10-15
 * With no period the report shows last month. Dates are Colorado dates, and
 * both ends are included.
 *
 * &refunds=made counts each refund in the dates it was made. Without it, a
 * refund counts with its order's paid date (see src/lib/admin/tax-report.ts).
 */

import { customRangeBounds, denverDateString, isIsoDate } from "./sales-stats";
import type { RefundTiming } from "./tax-report";

export type TaxPeriod =
  | { type: "month"; year: number; month: number }
  | { type: "quarter"; year: number; quarter: number }
  | { type: "custom"; from: string; to: string };

type Params = Record<string, string | string[] | undefined>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Today in Colorado, as numbers. */
function today(now: Date): { year: number; month: number } {
  const [year, month] = denverDateString(now.toISOString()).split("-").map(Number);
  return { year, month };
}

/** The month before a month. */
function monthBefore(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function thisMonth(now: Date = new Date()): TaxPeriod {
  return { type: "month", ...today(now) };
}

export function lastMonth(now: Date = new Date()): TaxPeriod {
  const t = today(now);
  return { type: "month", ...monthBefore(t.year, t.month) };
}

export function thisQuarter(now: Date = new Date()): TaxPeriod {
  const t = today(now);
  return { type: "quarter", year: t.year, quarter: Math.ceil(t.month / 3) };
}

export function lastQuarter(now: Date = new Date()): TaxPeriod {
  const t = today(now);
  const q = Math.ceil(t.month / 3);
  return q === 1
    ? { type: "quarter", year: t.year - 1, quarter: 4 }
    : { type: "quarter", year: t.year, quarter: q - 1 };
}

/** The period in the address. Anything missing or wrong means last month. */
export function parseTaxPeriod(params: Params | URLSearchParams, now: Date = new Date()): TaxPeriod {
  const get = (name: string) =>
    params instanceof URLSearchParams ? (params.get(name) ?? undefined) : first(params[name]);
  const period = get("period") ?? "";

  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) {
    const m = Number(month[2]);
    if (m >= 1 && m <= 12) return { type: "month", year: Number(month[1]), month: m };
  }
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
  if (quarter) return { type: "quarter", year: Number(quarter[1]), quarter: Number(quarter[2]) };
  if (period === "custom") {
    const from = get("from") ?? "";
    const to = get("to") ?? "";
    if (isIsoDate(from) && isIsoDate(to)) {
      const [a, b] = from <= to ? [from, to] : [to, from];
      return { type: "custom", from: a, to: b };
    }
  }
  return lastMonth(now);
}

/** "refund" when the address asks for refunds in the dates they were made. */
export function parseRefundTiming(params: Params | URLSearchParams): RefundTiming {
  const value =
    params instanceof URLSearchParams ? params.get("refunds") : first(params.refunds);
  return value === "made" ? "refund" : "paid";
}

/** The value for ?period= (custom ranges also need from and to). */
export function periodValue(p: TaxPeriod): string {
  if (p.type === "month") return `${p.year}-${pad(p.month)}`;
  if (p.type === "quarter") return `${p.year}-Q${p.quarter}`;
  return "custom";
}

export function periodQuery(p: TaxPeriod, timing: RefundTiming = "paid"): string {
  const q = new URLSearchParams({ period: periodValue(p) });
  if (p.type === "custom") {
    q.set("from", p.from);
    q.set("to", p.to);
  }
  if (timing === "refund") q.set("refunds", "made");
  return `?${q.toString()}`;
}

export function samePeriod(a: TaxPeriod, b: TaxPeriod): boolean {
  return periodQuery(a) === periodQuery(b);
}

/** The first and last Colorado dates of the period, YYYY-MM-DD. */
export function periodDates(p: TaxPeriod): { from: string; to: string } {
  if (p.type === "custom") return { from: p.from, to: p.to };
  const firstMonth = p.type === "month" ? p.month : (p.quarter - 1) * 3 + 1;
  const lastMonthOf = p.type === "month" ? p.month : firstMonth + 2;
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(p.year, lastMonthOf, 0)).getUTCDate();
  return {
    from: `${p.year}-${pad(firstMonth)}-01`,
    to: `${p.year}-${pad(lastMonthOf)}-${pad(lastDay)}`,
  };
}

/** From midnight at the start of the first day to midnight after the last, Colorado time. */
export function periodBounds(p: TaxPeriod): { start: Date; end: Date } {
  const { from, to } = periodDates(p);
  return customRangeBounds(from, to);
}

/** "Oct 1, 2026" from "2026-10-01". */
function shortDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** "October 2026", "July to September 2026 (Q3)" or "Oct 1, 2026 to Oct 15, 2026". */
export function periodLabel(p: TaxPeriod): string {
  if (p.type === "month") return `${MONTHS[p.month - 1]} ${p.year}`;
  if (p.type === "quarter") {
    const firstMonth = (p.quarter - 1) * 3;
    return `${MONTHS[firstMonth]} to ${MONTHS[firstMonth + 2]} ${p.year} (Q${p.quarter})`;
  }
  return p.from === p.to ? shortDate(p.from) : `${shortDate(p.from)} to ${shortDate(p.to)}`;
}

/** A short name for download files: "2026-10", "2026-Q3" or "2026-10-01_to_2026-10-15". */
export function periodFileTag(p: TaxPeriod): string {
  return p.type === "custom" ? `${p.from}_to_${p.to}` : periodValue(p);
}

/** The months and quarters to offer in the pickers, newest first. */
export function periodChoices(now: Date = new Date()): { months: TaxPeriod[]; quarters: TaxPeriod[] } {
  const months: TaxPeriod[] = [];
  let m = today(now);
  for (let i = 0; i < 24; i++) {
    months.push({ type: "month", ...m });
    m = monthBefore(m.year, m.month);
  }
  const quarters: TaxPeriod[] = [];
  let q = thisQuarter(now) as Extract<TaxPeriod, { type: "quarter" }>;
  for (let i = 0; i < 8; i++) {
    quarters.push(q);
    q = q.quarter === 1
      ? { type: "quarter", year: q.year - 1, quarter: 4 }
      : { type: "quarter", year: q.year, quarter: q.quarter - 1 };
  }
  return { months, quarters };
}
