/**
 * Loads paid orders, their tax split and their refunds for the tax report
 * and its download. Server code only.
 *
 * It reads with the admin's own sign-in, so the database's admin-only rules
 * still apply. Until the order_tax_parts table is in the database, it loads
 * the orders without their split or refunds and the report says so.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isOrdersDemo } from "@/app/admin/orders/order-data";
import { SALE_STATUSES } from "./sales-stats";
import {
  computeTaxReport,
  type RefundTiming,
  type TaxReport,
  type TaxReportOrderRow,
} from "./tax-report";
import { periodBounds, type TaxPeriod } from "./tax-report-filters";

/** Supabase sends at most 1000 rows per request. */
const PAGE_SIZE = 1000;

const ORDER_COLUMNS =
  "id, order_number, status, subtotal_cents, tax_cents, total_cents, refunded_cents, tax_rate_bps, tax_jurisdiction, paid_at, square_environment";
const PART_COLUMNS =
  "order_tax_parts(kind, name, census_geoid, collected_by, rate_bps, taxable_cents, tax_cents)";
const REFUND_FIELDS = "amount_cents, status, jars_cents, fees_cents, tax_cents, refunded_at";
const REFUND_COLUMNS = `order_refunds(${REFUND_FIELDS})`;

/** Sales, plus full refunds and cancelled orders for the notes. */
const LOADED_STATUSES = [...SALE_STATUSES, "refunded", "cancelled"];

const LOAD_ERROR =
  "The tax report didn't load. Reload the page. If it keeps happening, tell Nick.";

type Query = ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>;
type Filter = (query: ReturnType<Query["select"]>) => ReturnType<Query["select"]>;

async function loadPages(columns: string, filter: Filter) {
  const supabase = await createClient();
  const rows: TaxReportOrderRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await filter(supabase.from("orders").select(columns))
      // Orders with no Square system recorded are not tests, so keep them.
      .or("square_environment.is.null,square_environment.neq.sandbox")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { rows: null, error: error.message };
    rows.push(...((data ?? []) as unknown as TaxReportOrderRow[]));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}

/** Orders paid inside the dates. */
function paidIn(start: Date, end: Date): Filter {
  return (query) =>
    query
      .in("status", LOADED_STATUSES)
      .gte("paid_at", start.toISOString())
      .lt("paid_at", end.toISOString());
}

/**
 * Orders with a finished refund made inside the dates, whenever they were
 * paid. Each comes with only those refunds.
 */
function refundedIn(start: Date, end: Date): Filter {
  return (query) =>
    query
      .not("paid_at", "is", null)
      .eq("order_refunds.status", "COMPLETED")
      .gte("order_refunds.refunded_at", start.toISOString())
      .lt("order_refunds.refunded_at", end.toISOString());
}

export interface TaxReportResult {
  report: TaxReport | null;
  error: string | null;
}

export async function loadTaxReport(
  period: TaxPeriod,
  refundTiming: RefundTiming = "paid"
): Promise<TaxReportResult> {
  const { start, end } = periodBounds(period);
  const options = { start, end, saleStatuses: SALE_STATUSES, refundTiming };

  if (isOrdersDemo()) {
    const { DEMO_ORDERS } = await import("@/app/admin/orders/demo-orders");
    const rows = DEMO_ORDERS.map(({ order, refunds }) => ({
      ...order,
      order_tax_parts: [],
      order_refunds: refunds ?? [],
    }));
    return {
      report: computeTaxReport(rows, { ...options, partsAvailable: true, refundOrders: rows }),
      error: null,
    };
  }

  const withParts = await loadPages(
    `${ORDER_COLUMNS}, ${PART_COLUMNS}, ${REFUND_COLUMNS}`,
    paidIn(start, end)
  );
  if (withParts.rows) {
    let refundOrders: TaxReportOrderRow[] = [];
    if (refundTiming === "refund") {
      const refunded = await loadPages(
        `${ORDER_COLUMNS}, ${PART_COLUMNS}, order_refunds!inner(${REFUND_FIELDS})`,
        refundedIn(start, end)
      );
      if (!refunded.rows) {
        console.error("Loading refunds for the tax report failed:", refunded.error);
        return { report: null, error: LOAD_ERROR };
      }
      refundOrders = refunded.rows;
    }
    return {
      report: computeTaxReport(withParts.rows, { ...options, partsAvailable: true, refundOrders }),
      error: null,
    };
  }

  // Most likely the order_tax_parts table isn't there yet. Try without it.
  const withoutParts = await loadPages(ORDER_COLUMNS, paidIn(start, end));
  if (withoutParts.rows) {
    console.warn("Tax report: loaded without the tax split:", withParts.error);
    return {
      report: computeTaxReport(withoutParts.rows, { ...options, partsAvailable: false }),
      error: null,
    };
  }
  console.error("Loading the tax report failed:", withoutParts.error);
  return { report: null, error: LOAD_ERROR };
}
