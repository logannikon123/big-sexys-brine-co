/**
 * Loads orders for the admin pages. Server code only.
 *
 * On a local computer with ORDERS_DEMO=true in .env.development.local, the
 * pages show the made-up orders in demo-orders.ts instead of the database.
 * The live site always runs as "production", so it never reaches the demo.
 */

import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatus } from "@/types/orders";
import type {
  OrderListRow,
  OrderView,
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
  "id, order_number, status, fulfillment_type, delivery_date, is_rush, customer_name, total_cents, created_at, square_environment, order_items(quantity)";

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
  const statuses: readonly OrderStatus[] | null = view.statuses;

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
      item_count: countJars(items),
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      orders: statuses ? all.filter((o) => statuses.includes(o.status)) : all,
      anyOrders: all.length > 0,
      error: null,
    };
  }

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (statuses) query = query.in("status", [...statuses]);

  const { data, error } = await query;
  if (error) {
    console.error("Loading the order list failed:", error.message);
    return { orders: [], anyOrders: true, error: LOAD_ERROR };
  }

  const orders = ((data ?? []) as ListQueryRow[]).map(
    ({ order_items, ...row }) => ({ ...row, item_count: countJars(order_items) })
  );

  // An empty tab could mean no orders at all, or just none in this tab.
  let anyOrders = orders.length > 0;
  if (!anyOrders && statuses) {
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
}

/** One order and its jars, or null when there is no such order. */
export async function loadOrder(id: string): Promise<OrderWithItems | null> {
  if (isOrdersDemo()) {
    const { DEMO_ORDERS } = await import("./demo-orders");
    return DEMO_ORDERS.find((d) => d.order.id === id) ?? null;
  }

  if (!isOrderId(id)) return null;

  const supabase = await createClient();
  const [{ data: order, error }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id)
        .order("id", { ascending: true }),
    ]);

  if (error || itemsError) {
    console.error(
      "Loading an order failed:",
      error?.message ?? itemsError?.message
    );
    throw new Error(LOAD_ERROR);
  }
  if (!order) return null;

  return { order: order as Order, items: (items ?? []) as OrderItem[] };
}

/** How many orders are paid and waiting to be packed. */
export async function countNewOrders(): Promise<number> {
  if (isOrdersDemo()) {
    const { DEMO_ORDERS } = await import("./demo-orders");
    return DEMO_ORDERS.filter((d) => d.order.status === "paid").length;
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid");
  return count ?? 0;
}
