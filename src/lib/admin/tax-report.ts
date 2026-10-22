/**
 * Adds up local food tax by city and county for the tax report at
 * /admin/sales/tax. Takes plain rows and returns plain numbers, so the math
 * can be checked without a database. Money is in whole cents; rates are in
 * hundredths of a percent.
 *
 * This file imports types only, so a plain script can check it.
 *
 * The rules:
 * - An order counts when it was paid inside the dates (by paid_at, in
 *   Colorado time), was paid through Square's live system, and has a sale
 *   status (the same list as the Sales page). Test orders never count.
 * - Orders refunded in full (refunded_cents reaches total_cents) are left
 *   out of the lines and listed in a note. So are cancelled orders that had
 *   been paid. This reads the money, not the status, so it works both with
 *   today's "refunded" status and with a separate refund state.
 * - Partial refunds stay in the lines. The site doesn't yet record how much
 *   of a partial refund was tax, so they are listed in a note instead.
 * - Each order with a tax split (order_tax_parts) adds its jar subtotal and
 *   its share of tax to the line for each place in the split. A place shows
 *   once for each rate it had during the dates.
 * - Orders with no rate on file (tax_rate_bps is null) paid 0% and have no
 *   split. They get their own count.
 * - Orders with a rate but no split were placed before the split was saved.
 *   They are grouped by their saved jurisdiction text and rate.
 */

import type { OrderStatus, SquareEnvironment } from "@/types/orders";
import type { FoodTaxCollector, FoodTaxKind } from "@/lib/food-tax-rates";

export interface TaxReportPartRow {
  kind: FoodTaxKind;
  name: string;
  census_geoid: string | null;
  collected_by: FoodTaxCollector | null;
  rate_bps: number;
  taxable_cents: number;
  tax_cents: number;
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
}

export interface TaxReportLine {
  key: string;
  name: string;
  kind: FoodTaxKind;
  censusGeoid: string | null;
  collectedBy: FoodTaxCollector | null;
  rateBps: number;
  orders: number;
  /** Jar sales the rate was charged on. */
  taxableCents: number;
  taxCents: number;
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
  jarSalesCents: number;
  taxCents: number;
}

export interface TaxReportNote {
  orders: number;
  jarSalesCents: number;
  taxCents: number;
  /** For partial refunds: the money given back (tax and other parts together). */
  refundedCents: number;
  orderNumbers: number[];
}

export interface TaxReport {
  /** False when the order_tax_parts table isn't in the database yet. */
  partsAvailable: boolean;
  /** Orders that count, and their jar sales and tax. */
  orders: number;
  jarSalesCents: number;
  taxCents: number;
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
  partialRefunds: TaxReportNote;
  fullRefunds: TaxReportNote;
  cancelledAfterPayment: TaxReportNote;
  /** Orders whose split doesn't add up to their tax. Should always be empty. */
  splitMismatches: number[];
}

export interface TaxReportOptions {
  /** Count orders paid at or after this moment. */
  start: Date;
  /** Count orders paid before this moment. */
  end: Date;
  /** The statuses that count as a sale (SALE_STATUSES on the Sales page). */
  saleStatuses: readonly string[];
  partsAvailable: boolean;
}

function emptyNote(): TaxReportNote {
  return { orders: 0, jarSalesCents: 0, taxCents: 0, refundedCents: 0, orderNumbers: [] };
}

function addToNote(note: TaxReportNote, order: TaxReportOrderRow) {
  note.orders += 1;
  note.jarSalesCents += order.subtotal_cents;
  note.taxCents += order.tax_cents;
  note.refundedCents += order.refunded_cents;
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

function addTextLine(
  map: Map<string, TaxTextLine>,
  order: TaxReportOrderRow,
  fallback: string
) {
  const jurisdiction = order.tax_jurisdiction?.trim() || fallback;
  const key = `${jurisdiction}|${order.tax_rate_bps ?? ""}`;
  let line = map.get(key);
  if (!line) {
    line = { key, jurisdiction, rateBps: order.tax_rate_bps, orders: 0, jarSalesCents: 0, taxCents: 0 };
    map.set(key, line);
  }
  line.orders += 1;
  line.jarSalesCents += order.subtotal_cents;
  line.taxCents += order.tax_cents;
}

function textLines(map: Map<string, TaxTextLine>): TaxTextLine[] {
  return [...map.values()].sort(
    (a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || (a.rateBps ?? -1) - (b.rateBps ?? -1)
  );
}

export function computeTaxReport(
  rows: readonly TaxReportOrderRow[],
  options: TaxReportOptions
): TaxReport {
  const startMs = options.start.getTime();
  const endMs = options.end.getTime();
  const sale = new Set(options.saleStatuses);

  const lines = new Map<string, TaxReportLine>();
  const noRate = new Map<string, TaxTextLine>();
  const beforeSplit = new Map<string, TaxTextLine>();
  const partialRefunds = emptyNote();
  const fullRefunds = emptyNote();
  const cancelledAfterPayment = emptyNote();
  const splitMismatches: number[] = [];
  let orders = 0;
  let jarSalesCents = 0;
  let taxCents = 0;

  // Oldest first, so the order numbers in the notes read in order.
  const inRange = rows
    .filter((o) => o.square_environment !== "sandbox" && o.paid_at)
    .filter((o) => {
      const paid = new Date(o.paid_at!).getTime();
      return paid >= startMs && paid < endMs;
    })
    .sort((a, b) => a.paid_at!.localeCompare(b.paid_at!) || a.order_number - b.order_number);

  for (const order of inRange) {
    const refundedInFull =
      // A string compare, because the refund rework drops this status.
      (order.status as string) === "refunded" ||
      (order.total_cents > 0 && order.refunded_cents >= order.total_cents);
    if (refundedInFull) {
      addToNote(fullRefunds, order);
      continue;
    }
    if (order.status === "cancelled") {
      addToNote(cancelledAfterPayment, order);
      continue;
    }
    if (!sale.has(order.status)) continue;

    orders += 1;
    jarSalesCents += order.subtotal_cents;
    taxCents += order.tax_cents;
    if (order.refunded_cents > 0) addToNote(partialRefunds, order);

    if (order.tax_rate_bps === null) {
      addTextLine(noRate, order, "Place not found");
      continue;
    }

    const parts = order.order_tax_parts ?? [];
    if (parts.length === 0) {
      addTextLine(beforeSplit, order, "Not recorded");
      continue;
    }

    const partsTax = parts.reduce((sum, p) => sum + p.tax_cents, 0);
    if (partsTax !== order.tax_cents) splitMismatches.push(order.order_number);

    for (const part of parts) {
      const place = part.census_geoid ?? part.name.trim().toLowerCase();
      const key = `${part.collected_by ?? "none"}|${part.kind}|${place}|${part.rate_bps}`;
      let line = lines.get(key);
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
        };
        lines.set(key, line);
      }
      line.orders += 1;
      line.taxableCents += part.taxable_cents;
      line.taxCents += part.tax_cents;
    }
  }

  const all = [...lines.values()];
  const noRateLines = textLines(noRate);
  const beforeLines = textLines(beforeSplit);
  return {
    partsAvailable: options.partsAvailable,
    orders,
    jarSalesCents,
    taxCents,
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
    partialRefunds,
    fullRefunds,
    cancelledAfterPayment,
    splitMismatches,
  };
}
