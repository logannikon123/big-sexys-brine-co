/**
 * Loads paid orders and their tax split for the tax report and its
 * download. Server code only.
 *
 * It reads with the admin's own sign-in, so the database's admin-only rules
 * still apply. Until the order_tax_parts table is in the database, it loads
 * the orders without their split and the report says so.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isOrdersDemo } from "@/app/admin/orders/order-data";
import { SALE_STATUSES } from "./sales-stats";
import { computeTaxReport, type TaxReport, type TaxReportOrderRow } from "./tax-report";
import { periodBounds, type TaxPeriod } from "./tax-report-filters";

/** Supabase sends at most 1000 rows per request. */
const PAGE_SIZE = 1000;

const ORDER_COLUMNS =
  "id, order_number, status, subtotal_cents, tax_cents, total_cents, refunded_cents, tax_rate_bps, tax_jurisdiction, paid_at, square_environment";
const PART_COLUMNS =
  "order_tax_parts(kind, name, census_geoid, collected_by, rate_bps, taxable_cents, tax_cents)";

/** Sales, plus full refunds and cancelled orders for the notes. */
const LOADED_STATUSES = [...SALE_STATUSES, "refunded", "cancelled"];

const LOAD_ERROR =
  "The tax report didn't load. Reload the page. If it keeps happening, tell Nick.";

async function loadPages(columns: string, start: Date, end: Date) {
  const supabase = await createClient();
  const rows: TaxReportOrderRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select(columns)
      .in("status", LOADED_STATUSES)
      .gte("paid_at", start.toISOString())
      .lt("paid_at", end.toISOString())
      // Orders with no Square system recorded are not tests, so keep them.
      .or("square_environment.is.null,square_environment.neq.sandbox")
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows: null, error: error.message };
    rows.push(...((data ?? []) as unknown as TaxReportOrderRow[]));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}

export interface TaxReportResult {
  report: TaxReport | null;
  error: string | null;
}

export async function loadTaxReport(period: TaxPeriod): Promise<TaxReportResult> {
  const { start, end } = periodBounds(period);
  const options = { start, end, saleStatuses: SALE_STATUSES };

  if (isOrdersDemo()) {
    const { DEMO_ORDERS } = await import("@/app/admin/orders/demo-orders");
    const rows = DEMO_ORDERS.map(({ order }) => ({ ...order, order_tax_parts: [] }));
    return { report: computeTaxReport(rows, { ...options, partsAvailable: true }), error: null };
  }

  const withParts = await loadPages(`${ORDER_COLUMNS}, ${PART_COLUMNS}`, start, end);
  if (withParts.rows) {
    return { report: computeTaxReport(withParts.rows, { ...options, partsAvailable: true }), error: null };
  }

  // Most likely the order_tax_parts table isn't there yet. Try without it.
  const withoutParts = await loadPages(ORDER_COLUMNS, start, end);
  if (withoutParts.rows) {
    console.warn("Tax report: loaded without the tax split:", withParts.error);
    return { report: computeTaxReport(withoutParts.rows, { ...options, partsAvailable: false }), error: null };
  }
  console.error("Loading the tax report failed:", withoutParts.error);
  return { report: null, error: LOAD_ERROR };
}
