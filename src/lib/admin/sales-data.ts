/**
 * Loads orders for the admin sales page and its downloads. Server code only.
 *
 * It reads with the admin's own sign-in, so the database's admin-only rules
 * still apply. On a local computer in demo mode (see
 * src/app/admin/orders/order-data.ts) it uses the made-up demo orders.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isOrdersDemo } from "@/app/admin/orders/order-data";
import {
  LOADED_STATUSES,
  computeSalesStats,
  sortCustomers,
  sortProducts,
  type SalesOrderRow,
  type SalesStats,
} from "./sales-stats";
import { rangeBounds, type SalesFilters } from "./sales-filters";

/** Supabase sends at most 1000 rows per request. */
const PAGE_SIZE = 1000;

const COLUMNS =
  "id, order_number, status, fulfillment_type, customer_name, customer_email, total_cents, tax_cents, refunded_cents, created_at, square_environment, order_items(product_id, product_name, product_size, quantity, line_total_cents)";

const LOAD_ERROR =
  "The sales numbers didn't load. Reload the page. If it keeps happening, tell Nick.";

async function loadRows(filters: SalesFilters, start: Date | null, end: Date | null): Promise<SalesOrderRow[]> {
  if (isOrdersDemo()) {
    const { DEMO_ORDERS } = await import("@/app/admin/orders/demo-orders");
    return DEMO_ORDERS.map(({ order, items }) => ({ ...order, order_items: items }));
  }

  const supabase = await createClient();
  const rows: SalesOrderRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("orders")
      .select(COLUMNS)
      .in("status", [...LOADED_STATUSES])
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (start) query = query.gte("created_at", start.toISOString());
    if (end) query = query.lt("created_at", end.toISOString());
    // Orders with no Square system recorded are not tests, so keep them.
    if (!filters.includeTests) {
      query = query.or("square_environment.is.null,square_environment.neq.sandbox");
    }
    const { data, error } = await query;
    if (error) {
      console.error("Loading sales failed:", error.message);
      throw new Error(LOAD_ERROR);
    }
    rows.push(...((data ?? []) as SalesOrderRow[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export interface SalesResult {
  stats: SalesStats | null;
  error: string | null;
}

/** The stats for the chosen range, with the tables sorted as asked. */
export async function loadSalesStats(filters: SalesFilters): Promise<SalesResult> {
  const { start, end } = rangeBounds(filters);
  let rows: SalesOrderRow[];
  try {
    rows = await loadRows(filters, start, end);
  } catch (e) {
    return { stats: null, error: e instanceof Error ? e.message : LOAD_ERROR };
  }
  // The database already filtered, but the stats module applies the same
  // rules again, so its numbers never depend on how the rows were loaded.
  const stats = computeSalesStats(rows, { start, end, includeTests: filters.includeTests });
  return {
    stats: {
      ...stats,
      products: sortProducts(stats.products, filters.productSort),
      customers: sortCustomers(stats.customers, filters.customerSort),
    },
    error: null,
  };
}
