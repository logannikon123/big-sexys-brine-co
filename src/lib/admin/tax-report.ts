/**
 * Adds up local food tax by city and county for the tax report at
 * /admin/sales/tax. Takes plain rows and returns plain numbers, so the math
 * can be checked without a database. Money is in whole cents; rates are in
 * hundredths of a percent.
 *
 * Besides types, this file imports only src/lib/tax-split.ts, which has no
 * imports, so a plain script can check it.
 *
 * The rules:
 * - An order counts when it was paid inside the dates (by paid_at, in
 *   Colorado time), was paid through Square's live system, and has a sale
 *   status (the same list as the Sales page). Test orders never count.
 * - Each order with a tax split (order_tax_parts) adds its jar subtotal and
 *   its share of tax to the line for each place in the split. A place shows
 *   once for each rate it had during the dates.
 * - Orders with no rate on file (tax_rate_bps is null) paid 0% and have no
 *   split. They get their own count.
 * - Orders with a rate but no split were placed before the split was saved.
 *   They are grouped by their saved jurisdiction text and rate.
 *
 * Refunds (only those Square finished, status COMPLETED):
 * - A refund with a known split (order_refunds.jars_cents and tax_cents)
 *   comes off the lines of its order's places: its jars off each place's
 *   taxable sales, and its tax shared between the places the same way an
 *   order's tax is (splitTaxCents). The webhook knows the split for a refund
 *   of the whole order; for a part refund Jesse gives it on the order page.
 * - A refund with no split ("Not sure", or not answered) stays counted in
 *   full and is listed in a note.
 * - refundTiming says which dates a refund belongs to:
 *   "paid": the order's paid date, as before. Orders refunded in full
 *   (refunded_cents reaches total_cents) and cancelled orders are left out
 *   of the lines and listed in notes. A report for a month already filed
 *   changes when one of its orders is refunded later.
 *   "refund": the day of the refund. Every paid order counts as a sale in
 *   the dates it was paid, even if refunded or cancelled later, and each
 *   refund comes off in the dates it was made. A filed month never changes.
 */

import type { OrderStatus, SquareEnvironment } from "@/types/orders";
import type { FoodTaxCollector, FoodTaxKind } from "@/lib/food-tax-rates";
import { splitTaxCents } from "@/lib/tax-split";

export interface TaxReportPartRow {
  kind: FoodTaxKind;
  name: string;
  census_geoid: string | null;
  collected_by: FoodTaxCollector | null;
  rate_bps: number;
  taxable_cents: number;
  tax_cents: number;
}

export interface TaxReportRefundRow {
  amount_cents: number;
  /** Square's word. Only COMPLETED refunds gave money back. */
  status: string;
  /** The split, or all three null when it isn't known. */
  jars_cents: number | null;
  fees_cents: number | null;
  tax_cents: number | null;
  refunded_at: string;
}

export interface TaxReportOrderRow {
  id: string;
  order_number: number;
  status: OrderStatus;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  refunded_cents: number;
  tax_rate_bps: number | null;
  tax_jurisdiction: string | null;
  paid_at: string | null;
  square_environment: SquareEnvironment | null;
  /** Missing when the order_tax_parts table isn't there yet. */
  order_tax_parts?: TaxReportPartRow[] | null;
  /** Missing when the refunds weren't loaded. */
  order_refunds?: TaxReportRefundRow[] | null;
}

export interface TaxReportLine {
  key: string;
  name: string;
  kind: FoodTaxKind;
  censusGeoid: string | null;
  collectedBy: FoodTaxCollector | null;
  rateBps: number;
  orders: number;
  /** Jar sales the rate was charged on, less refunded jars. */
  taxableCents: number;
  /** Tax collected, less refunded tax. */
  taxCents: number;
  /** The refunded jars and tax already taken off the two numbers above. */
  refundTaxableCents: number;
  refundTaxCents: number;
}

export interface TaxReportGroup {
  lines: TaxReportLine[];
  taxCents: number;
}

/** Orders grouped by their saved jurisdiction text (and rate, when there is one). */
export interface TaxTextLine {
  key: string;
  jurisdiction: string;
  /** Null for orders that had no rate on file. */
  rateBps: number | null;
  orders: number;
  /** Less refunded jars and tax, as on TaxReportLine. */
  jarSalesCents: number;
  taxCents: number;
  refundJarsCents: number;
  refundTaxCents: number;
}

export interface TaxReportNote {
  orders: number;
  jarSalesCents: number;
  taxCents: number;
  /** The money given back (tax and other parts together). */
  refundedCents: number;
  orderNumbers: number[];
}

export type RefundTiming = "paid" | "refund";

export interface TaxReport {
  /** False when the order_tax_parts table isn't in the database yet. */
  partsAvailable: boolean;
  refundTiming: RefundTiming;
  /** Orders that count, and their jar sales and tax, less known refunds. */
  orders: number;
  jarSalesCents: number;
  taxCents: number;
  /** Refunds with a known split, taken off the numbers above. */
  refundsTaken: { refunds: number; jarsCents: number; taxCents: number; orderNumbers: number[] };
  /** Places the state collects for: the state return. */
  state: TaxReportGroup;
  /** Cities that collect their own tax: one city return each. */
  self: TaxReportGroup;
  /** Places with no local sales tax, so nothing to file. */
  none: TaxReportGroup;
  /** Orders that paid 0% because no rate was on file. */
  noRate: { orders: number; jarSalesCents: number; lines: TaxTextLine[] };
  /** Orders placed before the split was saved. */
  beforeSplit: { orders: number; jarSalesCents: number; taxCents: number; lines: TaxTextLine[] };
  /**
   * Orders with refunded money whose split isn't known: still counted in
   * full. refundedCents is only the money with no split.
   */
  unsplitRefunds: TaxReportNote;
  /** "paid" timing: left out. "refund" timing: counted as sales. */
  fullRefunds: TaxReportNote;
  cancelledAfterPayment: TaxReportNote;
  /** Orders whose split doesn't add up to their tax. Should always be empty. */
  splitMismatches: number[];
}

export interface TaxReportOptions {
  /** Count orders paid (and, for "refund" timing, refunds made) at or after this moment. */
  start: Date;
  /** ...and before this moment. */
  end: Date;
  /** The statuses that count as a sale (SALE_STATUSES on the Sales page). */
  saleStatuses: readonly string[];
  partsAvailable: boolean;
  /** "paid" when left out. */
  refundTiming?: RefundTiming;
  /**
   * For "refund" timing: orders with a refund made inside the dates, whenever
   * they were paid, each with its refunds. Refunds outside the dates are
   * skipped.
   */
  refundOrders?: readonly TaxReportOrderRow[];
}

function emptyNote(): TaxReportNote {
  return { orders: 0, jarSalesCents: 0, taxCents: 0, refundedCents: 0, orderNumbers: [] };
}

function addToNote(
  note: TaxReportNote,
  order: TaxReportOrderRow,
  refundedCents = order.refunded_cents
) {
  note.orders += 1;
  note.jarSalesCents += order.subtotal_cents;
  note.taxCents += order.tax_cents;
  note.refundedCents += refundedCents;
  note.orderNumbers.push(order.order_number);
}

const KIND_ORDER: Record<FoodTaxKind, number> = { city: 0, county: 1, district: 2 };

/** By name, then city before county, then lowest rate first. */
function byPlace(a: TaxReportLine, b: TaxReportLine): number {
  return (
    a.name.localeCompare(b.name) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.rateBps - b.rateBps
  );
}

function group(lines: TaxReportLine[]): TaxReportGroup {
  const sorted = [...lines].sort(byPlace);
  return { lines: sorted, taxCents: sorted.reduce((sum, l) => sum + l.taxCents, 0) };
}

function textLine(
  map: Map<string, TaxTextLine>,
  order: TaxReportOrderRow,
  fallback: string
): TaxTextLine {
  const jurisdiction = order.tax_jurisdiction?.trim() || fallback;
  const key = `${jurisdiction}|${order.tax_rate_bps ?? ""}`;
  let line = map.get(key);
  if (!line) {
    line = {
      key,
      jurisdiction,
      rateBps: order.tax_rate_bps,
      orders: 0,
      jarSalesCents: 0,
      taxCents: 0,
      refundJarsCents: 0,
      refundTaxCents: 0,
    };
    map.set(key, line);
  }
  return line;
}

function textLines(map: Map<string, TaxTextLine>): TaxTextLine[] {
  return [...map.values()].sort(
    (a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || (a.rateBps ?? -1) - (b.rateBps ?? -1)
  );
}

function placeLine(map: Map<string, TaxReportLine>, part: TaxReportPartRow): TaxReportLine {
  const place = part.census_geoid ?? part.name.trim().toLowerCase();
  const key = `${part.collected_by ?? "none"}|${part.kind}|${place}|${part.rate_bps}`;
  let line = map.get(key);
  if (!line) {
    line = {
      key,
      name: part.name,
      kind: part.kind,
      censusGeoid: part.census_geoid,
      collectedBy: part.collected_by,
      rateBps: part.rate_bps,
      orders: 0,
      taxableCents: 0,
      taxCents: 0,
      refundTaxableCents: 0,
      refundTaxCents: 0,
    };
    map.set(key, line);
  }
  return line;
}

type SplitRefund = TaxReportRefundRow & { jars_cents: number; tax_cents: number };

function hasSplit(refund: TaxReportRefundRow): refund is SplitRefund {
  return refund.jars_cents !== null && refund.tax_cents !== null;
}

export function computeTaxReport(
  rows: readonly TaxReportOrderRow[],
  options: TaxReportOptions
): TaxReport {
  const startMs = options.start.getTime();
  const endMs = options.end.getTime();
  const inDates = (iso: string) => {
    const ms = new Date(iso).getTime();
    return ms >= startMs && ms < endMs;
  };
  const sale = new Set(options.saleStatuses);
  const timing: RefundTiming = options.refundTiming ?? "paid";

  const lines = new Map<string, TaxReportLine>();
  const noRate = new Map<string, TaxTextLine>();
  const beforeSplit = new Map<string, TaxTextLine>();
  const refundsTaken: TaxReport["refundsTaken"] = {
    refunds: 0,
    jarsCents: 0,
    taxCents: 0,
    orderNumbers: [],
  };
  const unsplitRefunds = emptyNote();
  const fullRefunds = emptyNote();
  const cancelledAfterPayment = emptyNote();
  const splitMismatches: number[] = [];
  let orders = 0;
  let jarSalesCents = 0;
  let taxCents = 0;

  /** Add a paid order to the totals and to its lines. */
  function addSale(order: TaxReportOrderRow) {
    orders += 1;
    jarSalesCents += order.subtotal_cents;
    taxCents += order.tax_cents;

    const parts = order.tax_rate_bps === null ? [] : (order.order_tax_parts ?? []);
    if (parts.length === 0) {
      const line =
        order.tax_rate_bps === null
          ? textLine(noRate, order, "Place not found")
          : textLine(beforeSplit, order, "Not recorded");
      line.orders += 1;
      line.jarSalesCents += order.subtotal_cents;
      line.taxCents += order.tax_cents;
      return;
    }
    const partsTax = parts.reduce((sum, p) => sum + p.tax_cents, 0);
    if (partsTax !== order.tax_cents) splitMismatches.push(order.order_number);
    for (const part of parts) {
      const line = placeLine(lines, part);
      line.orders += 1;
      line.taxableCents += part.taxable_cents;
      line.taxCents += part.tax_cents;
    }
  }

  /** Take a refund with a known split off the totals and its order's lines. */
  function takeRefund(order: TaxReportOrderRow, refund: SplitRefund) {
    const jars = refund.jars_cents;
    const tax = refund.tax_cents;
    jarSalesCents -= jars;
    taxCents -= tax;
    refundsTaken.refunds += 1;
    refundsTaken.jarsCents += jars;
    refundsTaken.taxCents += tax;
    if (!refundsTaken.orderNumbers.includes(order.order_number)) {
      refundsTaken.orderNumbers.push(order.order_number);
    }

    const parts = order.tax_rate_bps === null ? [] : (order.order_tax_parts ?? []);
    if (parts.length === 0) {
      const line =
        order.tax_rate_bps === null
          ? textLine(noRate, order, "Place not found")
          : textLine(beforeSplit, order, "Not recorded");
      line.jarSalesCents -= jars;
      line.taxCents -= tax;
      line.refundJarsCents += jars;
      line.refundTaxCents += tax;
      return;
    }
    const shares = splitTaxCents(
      jars,
      parts.map((p) => ({ rateBps: p.rate_bps })),
      tax
    );
    parts.forEach((part, i) => {
      const line = placeLine(lines, part);
      line.taxableCents -= jars;
      line.taxCents -= shares[i];
      line.refundTaxableCents += jars;
      line.refundTaxCents += shares[i];
    });
  }

  const live = (o: TaxReportOrderRow) =>
    o.square_environment !== "sandbox" && Boolean(o.paid_at);
  const oldestFirst = (a: TaxReportOrderRow, b: TaxReportOrderRow) =>
    a.paid_at!.localeCompare(b.paid_at!) || a.order_number - b.order_number;

  // Oldest first, so the order numbers in the notes read in order.
  const inRange = rows.filter((o) => live(o) && inDates(o.paid_at!)).sort(oldestFirst);

  for (const order of inRange) {
    const refundedInFull =
      // A string compare, because the refund rework dropped this status.
      (order.status as string) === "refunded" ||
      (order.total_cents > 0 && order.refunded_cents >= order.total_cents);
    const cancelled = order.status === "cancelled";
    if (!refundedInFull && !cancelled && !sale.has(order.status)) continue;

    if (timing === "refund") {
      // Refunds come off in the dates they were made (below), so every paid
      // order is a sale here. The notes list the ones refunded or cancelled.
      if (refundedInFull) addToNote(fullRefunds, order);
      else if (cancelled) addToNote(cancelledAfterPayment, order);
      addSale(order);
      continue;
    }

    if (refundedInFull) {
      addToNote(fullRefunds, order);
      continue;
    }
    if (cancelled) {
      addToNote(cancelledAfterPayment, order);
      continue;
    }
    addSale(order);
    let known = 0;
    for (const refund of order.order_refunds ?? []) {
      if (refund.status !== "COMPLETED" || !hasSplit(refund)) continue;
      takeRefund(order, refund);
      known += refund.amount_cents;
    }
    const unknown = order.refunded_cents - known;
    if (unknown > 0) addToNote(unsplitRefunds, order, unknown);
  }

  if (timing === "refund") {
    const refundOrders = (options.refundOrders ?? []).filter(live).sort(oldestFirst);
    for (const order of refundOrders) {
      let unknown = 0;
      for (const refund of order.order_refunds ?? []) {
        if (refund.status !== "COMPLETED" || !inDates(refund.refunded_at)) continue;
        if (hasSplit(refund)) takeRefund(order, refund);
        else unknown += refund.amount_cents;
      }
      if (unknown > 0) addToNote(unsplitRefunds, order, unknown);
    }
  }

  const all = [...lines.values()];
  const noRateLines = textLines(noRate);
  const beforeLines = textLines(beforeSplit);
  return {
    partsAvailable: options.partsAvailable,
    refundTiming: timing,
    orders,
    jarSalesCents,
    taxCents,
    refundsTaken,
    state: group(all.filter((l) => l.collectedBy === "state")),
    self: group(all.filter((l) => l.collectedBy === "self")),
    none: group(all.filter((l) => l.collectedBy === null)),
    noRate: {
      orders: noRateLines.reduce((sum, l) => sum + l.orders, 0),
      jarSalesCents: noRateLines.reduce((sum, l) => sum + l.jarSalesCents, 0),
      lines: noRateLines,
    },
    beforeSplit: {
      orders: beforeLines.reduce((sum, l) => sum + l.orders, 0),
      jarSalesCents: beforeLines.reduce((sum, l) => sum + l.jarSalesCents, 0),
      taxCents: beforeLines.reduce((sum, l) => sum + l.taxCents, 0),
      lines: beforeLines,
    },
    unsplitRefunds,
    fullRefunds,
    cancelledAfterPayment,
    splitMismatches,
  };
}

/** Why a report with no orders counted is empty, in one sentence. */
export function emptyReason(report: TaxReport): string {
  const leftOut = report.fullRefunds.orders + report.cancelledAfterPayment.orders;
  if (leftOut === 0) {
    return "No orders were paid in these dates, so there is no local food tax to report.";
  }
  const count = leftOut === 1 ? "The one order" : `All ${leftOut} orders`;
  return `${count} paid in these dates ${leftOut === 1 ? "was" : "were"} refunded in full or cancelled, so there is no local food tax to report.`;
}
