/**
 * Adds up online orders for the admin sales page. Server code only.
 *
 * Every function here takes plain rows and returns plain numbers, so the
 * math is easy to check without a database. Money is in whole cents.
 *
 * The rules:
 * - A sale is an order with a step in SALE_STATUSES that wasn't refunded in
 *   full and didn't lose a card dispute. Orders that were never paid, were
 *   cancelled, were refunded in full or lost a dispute (the bank took the
 *   money back) don't count.
 * - Net sales for an order = total_cents - refunded_cents. The total
 *   includes tax and fees.
 * - Orders paid through Square's test system (square_environment =
 *   "sandbox") are tests. They count only when asked for.
 */

import "server-only";
import { createHash } from "node:crypto";
import type {
  FulfillmentType,
  Order,
  OrderItem,
  OrderStatus,
} from "@/types/orders";
import { FULFILLMENT_TYPES } from "@/types/orders";

/** The statuses that count as a sale. */
export const SALE_STATUSES = [
  "paid",
  "ready_for_pickup",
  "out_for_delivery",
  "shipped",
  "fulfilled",
] as const satisfies readonly OrderStatus[];

/**
 * The steps the page loads: sales, plus cancelled orders, which may hold
 * full refunds for the refund total.
 */
export const LOADED_STATUSES = [
  ...SALE_STATUSES,
  "cancelled",
] as const satisfies readonly OrderStatus[];

export type SalesItemRow = Pick<
  OrderItem,
  "product_id" | "product_name" | "product_size" | "quantity" | "line_total_cents"
>;

export type SalesOrderRow = Pick<
  Order,
  | "id"
  | "order_number"
  | "status"
  | "fulfillment_type"
  | "customer_name"
  | "customer_email"
  | "total_cents"
  | "tax_cents"
  | "refunded_cents"
  | "refund_status"
  | "dispute_status"
  | "created_at"
  | "square_environment"
> & { order_items: SalesItemRow[] | null };

export function isSale(order: Pick<Order, "status" | "refund_status" | "dispute_status">): boolean {
  return (
    (SALE_STATUSES as readonly OrderStatus[]).includes(order.status) &&
    order.refund_status !== "full" &&
    order.dispute_status !== "lost"
  );
}

/** A paid order whose card dispute the bank decided for the customer. */
export function isLostDispute(order: Pick<Order, "refund_status" | "dispute_status">): boolean {
  return order.dispute_status === "lost" && order.refund_status !== "full";
}

export function isTestOrder(order: Pick<Order, "square_environment">): boolean {
  return order.square_environment === "sandbox";
}

export function netCents(order: Pick<Order, "total_cents" | "refunded_cents">): number {
  return order.total_cents - order.refunded_cents;
}

function jarCount(order: SalesOrderRow): number {
  return (order.order_items ?? []).reduce((sum, i) => sum + i.quantity, 0);
}

/* ---------- Dates, in Colorado time ---------- */

export const STORE_TIME_ZONE = "America/Denver";

/** The calendar date in Colorado for a moment: { year, month (1-12), day }. */
function denverDate(at: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * Colorado clock time minus UTC at a moment, in milliseconds. Negative: -6
 * hours in summer, -7 in winter.
 */
function denverOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  // The clock reading has no milliseconds, so drop them from the moment too.
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The moment midnight starts on a Colorado calendar date. Month is 1-12. */
export function denverMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - denverOffsetMs(new Date(guess));
  // Check once more in case the clocks changed between the guess and the answer.
  result = guess - denverOffsetMs(new Date(result));
  return new Date(result);
}

export const SALES_RANGES = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "year", label: "This year", days: null },
  { key: "all", label: "All time", days: null },
] as const;

export type SalesRangeKey = (typeof SALES_RANGES)[number]["key"];

/**
 * When a range starts, or null for all time. "Last 7 days" means today and
 * the 6 days before it, from midnight in Colorado.
 */
export function rangeStart(range: SalesRangeKey, now: Date = new Date()): Date | null {
  if (range === "all") return null;
  const today = denverDate(now);
  if (range === "year") return denverMidnight(today.year, 1, 1);
  const days = SALES_RANGES.find((r) => r.key === range)?.days ?? 30;
  // Date.UTC rolls a day of 0 or less back into the month before.
  const first = new Date(Date.UTC(today.year, today.month - 1, today.day - (days - 1)));
  return denverMidnight(first.getUTCFullYear(), first.getUTCMonth() + 1, first.getUTCDate());
}

/** True when the text is a real calendar date written YYYY-MM-DD. */
export function isIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * A custom range from one Colorado calendar date to another, both days
 * included: from midnight at the start of "from" to midnight at the end of
 * "to". Dates are YYYY-MM-DD and already checked.
 */
export function customRangeBounds(from: string, to: string): { start: Date; end: Date } {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  // Date.UTC rolls day 32 over into the next month, and so on.
  const after = new Date(Date.UTC(ty, tm - 1, td + 1));
  return {
    start: denverMidnight(fy, fm, fd),
    end: denverMidnight(after.getUTCFullYear(), after.getUTCMonth() + 1, after.getUTCDate()),
  };
}

/** "2026-10-19": the Colorado calendar date of a moment. */
export function denverDateString(iso: string): string {
  const { year, month, day } = denverDate(new Date(iso));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/* ---------- The stats ---------- */

export interface FulfillmentStats {
  type: FulfillmentType;
  orders: number;
  netCents: number;
}

export interface SalesSummary {
  orders: number;
  netCents: number;
  averageOrderCents: number;
  jars: number;
  taxCents: number;
  /** Money refunded: part refunds on sales and lost disputes, plus full refunds. */
  refundsCents: number;
  /** Orders refunded in full. They aren't sales, so they show only here. */
  fullyRefundedOrders: number;
  /** Orders that lost a card dispute. They aren't sales either. */
  lostDisputeOrders: number;
  /** What the bank took back on those orders: their total less any refunds. */
  lostDisputeCents: number;
  byFulfillment: FulfillmentStats[];
}

export interface ProductStats {
  key: string;
  productId: number | null;
  name: string;
  size: string | null;
  units: number;
  orders: number;
  revenueCents: number;
  /** This product's part of all jar sales, from 0 to 1. */
  share: number;
}

export interface CustomerOrder {
  id: string;
  orderNumber: number;
  createdAt: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  jars: number;
  totalCents: number;
  refundedCents: number;
  netCents: number;
  isTest: boolean;
}

export interface CustomerStats {
  /** A short code for the customer's page, so the email stays out of links. */
  key: string;
  email: string;
  name: string;
  orders: number;
  netCents: number;
  averageOrderCents: number;
  firstOrderAt: string;
  lastOrderAt: string;
  favoriteProduct: string | null;
  usualFulfillment: FulfillmentType;
  /** Newest first. */
  orderList: CustomerOrder[];
}

export interface SalesStats {
  summary: SalesSummary;
  products: ProductStats[];
  customers: CustomerStats[];
}

export interface SalesOptions {
  /** Leave out orders before this moment. Null means all time. */
  start: Date | null;
  /** Leave out orders at or after this moment. Null means up to now. */
  end?: Date | null;
  includeTests: boolean;
}

/** Email in lower case, without spaces at either end. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The code for a customer's page: part of a SHA-256 hash of the email. */
export function customerKey(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 16);
}

/** "Bread & Butter (16oz)", or just the name when there is no size. */
export function productLabel(name: string, size: string | null): string {
  return size ? `${name} (${size})` : name;
}

function productKey(item: SalesItemRow): string {
  return item.product_id != null
    ? `id:${item.product_id}`
    : `name:${item.product_name.trim().toLowerCase()}|${(item.product_size ?? "").trim().toLowerCase()}`;
}

/** The orders that pass the date and test filters, newest first. */
export function filterOrders(rows: readonly SalesOrderRow[], options: SalesOptions): SalesOrderRow[] {
  const startMs = options.start?.getTime() ?? null;
  const endMs = options.end?.getTime() ?? null;
  return rows
    .filter((o) => options.includeTests || !isTestOrder(o))
    .filter((o) => startMs === null || new Date(o.created_at).getTime() >= startMs)
    .filter((o) => endMs === null || new Date(o.created_at).getTime() < endMs)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.order_number - a.order_number);
}

/** Integer cents, rounded to the nearest cent. */
function average(total: number, count: number): number {
  return count === 0 ? 0 : Math.round(total / count);
}

/** The key with the biggest number. Ties go to the one seen first. */
function topKey<K>(counts: Map<K, number>): K | null {
  let best: K | null = null;
  let bestCount = -Infinity;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export function computeSalesStats(rows: readonly SalesOrderRow[], options: SalesOptions): SalesStats {
  // Newest first, so the first name and product label seen is the newest.
  const inRange = filterOrders(rows, options);
  const sales = inRange.filter((o) => isSale(o));
  const fullRefunds = inRange.filter((o) => o.refund_status === "full");
  const lostDisputes = inRange.filter((o) => isLostDispute(o));

  // Summary
  const netTotal = sales.reduce((sum, o) => sum + netCents(o), 0);
  const summary: SalesSummary = {
    orders: sales.length,
    netCents: netTotal,
    averageOrderCents: average(netTotal, sales.length),
    jars: sales.reduce((sum, o) => sum + jarCount(o), 0),
    taxCents: sales.reduce((sum, o) => sum + o.tax_cents, 0),
    refundsCents: [...sales, ...fullRefunds, ...lostDisputes].reduce(
      (sum, o) => sum + o.refunded_cents,
      0
    ),
    fullyRefundedOrders: fullRefunds.length,
    lostDisputeOrders: lostDisputes.length,
    lostDisputeCents: lostDisputes.reduce((sum, o) => sum + netCents(o), 0),
    byFulfillment: FULFILLMENT_TYPES.map((type) => {
      const ofType = sales.filter((o) => o.fulfillment_type === type);
      return {
        type,
        orders: ofType.length,
        netCents: ofType.reduce((sum, o) => sum + netCents(o), 0),
      };
    }),
  };

  // Products
  const productMap = new Map<string, Omit<ProductStats, "share"> & { orderIds: Set<string> }>();
  for (const order of sales) {
    for (const item of order.order_items ?? []) {
      const key = productKey(item);
      let p = productMap.get(key);
      if (!p) {
        p = {
          key,
          productId: item.product_id,
          name: item.product_name,
          size: item.product_size,
          units: 0,
          orders: 0,
          revenueCents: 0,
          orderIds: new Set(),
        };
        productMap.set(key, p);
      }
      p.units += item.quantity;
      p.revenueCents += item.line_total_cents;
      p.orderIds.add(order.id);
    }
  }
  const itemRevenue = [...productMap.values()].reduce((sum, p) => sum + p.revenueCents, 0);
  const products: ProductStats[] = [...productMap.values()].map(({ orderIds, ...p }) => ({
    ...p,
    orders: orderIds.size,
    share: itemRevenue === 0 ? 0 : p.revenueCents / itemRevenue,
  }));

  // Customers
  const customerMap = new Map<string, SalesOrderRow[]>();
  for (const order of sales) {
    const email = normalizeEmail(order.customer_email);
    const list = customerMap.get(email);
    if (list) list.push(order);
    else customerMap.set(email, [order]);
  }
  const customers: CustomerStats[] = [...customerMap].map(([email, orders]) => {
    // orders is newest first.
    const net = orders.reduce((sum, o) => sum + netCents(o), 0);
    const units = new Map<string, number>();
    const labels = new Map<string, string>();
    const ways = new Map<FulfillmentType, number>();
    for (const o of orders) {
      ways.set(o.fulfillment_type, (ways.get(o.fulfillment_type) ?? 0) + 1);
      for (const item of o.order_items ?? []) {
        const key = productKey(item);
        units.set(key, (units.get(key) ?? 0) + item.quantity);
        if (!labels.has(key)) labels.set(key, productLabel(item.product_name, item.product_size));
      }
    }
    const favorite = topKey(units);
    return {
      key: customerKey(email),
      email,
      name: orders[0].customer_name,
      orders: orders.length,
      netCents: net,
      averageOrderCents: average(net, orders.length),
      firstOrderAt: orders[orders.length - 1].created_at,
      lastOrderAt: orders[0].created_at,
      favoriteProduct: favorite === null ? null : (labels.get(favorite) ?? null),
      usualFulfillment: topKey(ways) ?? orders[0].fulfillment_type,
      orderList: orders.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        createdAt: o.created_at,
        status: o.status,
        fulfillmentType: o.fulfillment_type,
        jars: jarCount(o),
        totalCents: o.total_cents,
        refundedCents: o.refunded_cents,
        netCents: netCents(o),
        isTest: isTestOrder(o),
      })),
    };
  });

  return {
    summary,
    products: sortProducts(products, "revenue"),
    customers: sortCustomers(customers, "spent"),
  };
}

/* ---------- Sorting ---------- */

export const PRODUCT_SORTS = ["revenue", "units"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const CUSTOMER_SORTS = ["spent", "orders", "last"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

/** Biggest first. Ties fall back to the other number, then the name. */
export function sortProducts(products: readonly ProductStats[], by: ProductSort): ProductStats[] {
  return [...products].sort((a, b) =>
    by === "units"
      ? b.units - a.units || b.revenueCents - a.revenueCents || a.name.localeCompare(b.name)
      : b.revenueCents - a.revenueCents || b.units - a.units || a.name.localeCompare(b.name)
  );
}

/** Biggest or newest first. Ties go to the newest order, then the email. */
export function sortCustomers(customers: readonly CustomerStats[], by: CustomerSort): CustomerStats[] {
  const newest = (a: CustomerStats, b: CustomerStats) => b.lastOrderAt.localeCompare(a.lastOrderAt);
  return [...customers].sort((a, b) => {
    const first =
      by === "spent" ? b.netCents - a.netCents : by === "orders" ? b.orders - a.orders : newest(a, b);
    return first || newest(a, b) || b.netCents - a.netCents || a.email.localeCompare(b.email);
  });
}
