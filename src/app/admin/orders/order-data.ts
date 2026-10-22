/**
 * Loads orders for the admin pages. Server code only.
 *
 * On a local computer with ORDERS_DEMO=true in .env.development.local, the
 * pages show the made-up orders in demo-orders.ts instead of the database.
 * The live site always runs as "production", so it never reaches the demo.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Order,
  OrderEmail,
  OrderItem,
  OrderRefund,
  OrderTaxPart,
} from "@/types/orders";
import {
  OPEN_STATUSES,
  TODO_COMPLETED_LIMIT,
  UNPAID_STATUSES,
  arrangeTodo,
  inView,
  type OrderListRow,
  type OrderView,
} from "@/components/admin/orders/order-flow";

/** True only on a local computer that has asked for demo orders. */
export function isOrdersDemo(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ORDERS_DEMO === "true"
  );
}

const LIST_LIMIT = 100;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Order ids are UUIDs. Anything else can't be an order. */
export function isOrderId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

const LIST_COLUMNS =
  "id, order_number, status, fulfillment_type, delivery_date, is_rush, customer_name, total_cents, created_at, square_environment, refund_status, dispute_status, order_items(quantity)";

type ListQueryRow = Omit<OrderListRow, "item_count"> & {
  order_items: { quantity: number }[] | null;
};

function countJars(items: { quantity: number }[] | null): number {
  return (items ?? []).reduce((sum, i) => sum + i.quantity, 0);
}

export interface OrderListResult {
  orders: OrderListRow[];
  /** False when the store has no orders at all, in any list. */
  anyOrders: boolean;
  error: string | null;
}

const LOAD_ERROR =
  "The orders didn't load. Reload the page. If it keeps happening, tell Nick.";

export async function loadOrderList(view: OrderView): Promise<OrderListResult> {
  if (isOrdersDemo()) {
    const { DEMO_ORDERS } = await import("./demo-orders");
    const all: OrderListRow[] = DEMO_ORDERS.map(({ order, items }) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      fulfillment_type: order.fulfillment_type,
      delivery_date: order.delivery_date,
      is_rush: order.is_rush,
      customer_name: order.customer_name,
      total_cents: order.total_cents,
      created_at: order.created_at,
      square_environment: order.square_environment,
      refund_status: order.refund_status,
      dispute_status: order.dispute_status,
      item_count: countJars(items),
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const shown = all.filter((o) => inView(view.key, o));
    return {
      orders: view.key === "todo" ? arrangeTodo(shown) : shown,
      anyOrders: all.length > 0,
      error: null,
    };
  }

  const supabase = await createClient();
  const listQuery = (limit = LIST_LIMIT) =>
    supabase
      .from("orders")
      .select(LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);

  // The same tabs as inView in order-flow.ts. "To do" loads open and
  // completed orders apart, so a pile of completed orders can never push an
  // open one off the list.
  const queries = {
    todo: () => [
      listQuery().in("status", [...OPEN_STATUSES]).neq("refund_status", "full"),
      listQuery(TODO_COMPLETED_LIMIT).eq("status", "fulfilled"),
    ],
    completed: () => [listQuery().eq("status", "fulfilled")],
    cancelled: () => [listQuery().or("status.eq.cancelled,refund_status.neq.none")],
    problems: () => [
      listQuery().or(`status.in.(${UNPAID_STATUSES.join(",")}),dispute_status.not.is.null`),
    ],
    all: () => [listQuery()],
  } satisfies Record<OrderView["key"], () => ReturnType<typeof listQuery>[]>;
  const results = await Promise.all(queries[view.key]());

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("Loading the order list failed:", failed.error.message);
    return { orders: [], anyOrders: true, error: LOAD_ERROR };
  }

  const rows = results.flatMap((r) => (r.data ?? []) as ListQueryRow[]);
  const orders = rows.map(({ order_items, ...row }) => ({
    ...row,
    item_count: countJars(order_items),
  }));

  // An empty tab could mean no orders at all, or just none in this tab.
  let anyOrders = orders.length > 0;
  if (!anyOrders && view.key !== "all") {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true });
    anyOrders = (count ?? 0) > 0;
  }

  return { orders, anyOrders, error: null };
}

export interface OrderWithItems {
  order: Order;
  items: OrderItem[];
  /** Refunds from Square, oldest first. */
  refunds: OrderRefund[];
  /** Emails sent to the customer after the receipt, oldest first. */
  emails: OrderEmail[];
  /** The order's tax split by city and county. Empty for older orders. */
  taxParts: OrderTaxPart[];
}

/** One order with its jars, refunds and emails, or null when there is no such order. */
export async function loadOrder(id: string): Promise<OrderWithItems | null> {
  if (isOrdersDemo()) {
    const { DEMO_ORDERS } = await import("./demo-orders");
    const demo = DEMO_ORDERS.find((d) => d.order.id === id);
    return demo ? { refunds: [], emails: [], taxParts: [], ...demo } : null;
  }

  if (!isOrderId(id)) return null;

  const supabase = await createClient();
  const [orderResult, itemsResult, refundsResult, emailsResult, partsResult] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id)
        .order("id", { ascending: true }),
      supabase
        .from("order_refunds")
        .select("*")
        .eq("order_id", id)
        .order("refunded_at", { ascending: true }),
      supabase
        .from("order_emails")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("order_tax_parts")
        .select("id, order_id, kind, name, collected_by, rate_bps, taxable_cents, tax_cents")
        .eq("order_id", id)
        .order("id", { ascending: true }),
    ]);

  const failed = [orderResult, itemsResult, refundsResult, emailsResult, partsResult].find(
    (r) => r.error
  );
  if (failed?.error) {
    console.error("Loading an order failed:", failed.error.message);
    throw new Error(LOAD_ERROR);
  }
  if (!orderResult.data) return null;

  return {
    order: orderResult.data as Order,
    items: (itemsResult.data ?? []) as OrderItem[],
    refunds: (refundsResult.data ?? []) as OrderRefund[],
    emails: (emailsResult.data ?? []) as OrderEmail[],
    taxParts: (partsResult.data ?? []) as OrderTaxPart[],
  };
}

/** How many orders are paid and waiting to be packed. */
export async function countNewOrders(): Promise<number> {
  if (isOrdersDemo()) {
    const { DEMO_ORDERS } = await import("./demo-orders");
    return DEMO_ORDERS.filter(
      (d) => d.order.status === "paid" && d.order.refund_status !== "full"
    ).length;
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid")
    .neq("refund_status", "full");
  return count ?? 0;
}
