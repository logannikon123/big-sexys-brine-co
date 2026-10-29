import "server-only";
import { alertOwner } from "@/lib/alerts";
import { createServiceClient } from "@/lib/supabase/server";
import { lowStockAlert, type ShortLine, type StockLevel } from "@/lib/stock";

/**
 * Taking jars off the stock counts and putting them back. The counting
 * happens in the database (see the product_stock migration), with the
 * service role key, because only checkout and the Square webhook write
 * orders.
 *
 * When the jars come off:
 *
 * 1. Checkout takes them right after it saves the order and before it
 *    charges the card (holdStock in src/lib/checkout/pay.ts). The database
 *    locks the products while it counts, so of two orders for the last jar,
 *    one gets it and the other is told it's gone before any card is charged.
 * 2. If the card fails, the jars go back (returnStockAfterFailure).
 * 3. When an order is marked paid (by checkout or the webhook),
 *    stockAfterPaid makes sure its jars came off (they nearly always did in
 *    step 1), then alerts Jesse about counts that are low or at 0.
 *
 * Each order takes its jars once: the database marks the order
 * (stock_taken_at) and a second call does nothing. A refund or a cancel
 * never puts jars back by itself. Jesse does that from the admin order page.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");

export type TakeResult =
  | { status: "taken"; short: ShortLine[]; products: (StockLevel & { taken: number })[] }
  | { status: "already" }
  | { status: "short"; short: ShortLine[] }
  | { status: "not_found" };

export type ReturnResult =
  | { status: "returned"; products: { product_id: number; name: string; stock_count: number; returned: number }[] }
  | { status: "already" | "not_taken" | "not_found" };

/**
 * Take an order's jars off the counts. With allowShort false it's all or
 * nothing; with allowShort true it takes what is there. Throws if the
 * database can't be reached.
 */
export async function takeOrderStock(orderId: string, allowShort: boolean): Promise<TakeResult> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("take_order_stock", {
    p_order_id: orderId,
    p_allow_short: allowShort,
  });
  if (error) throw new Error(`couldn't take the jars off the stock count: ${error.message}`);
  return data as TakeResult;
}

/** Put an order's jars back on the counts. Throws if the database can't be reached. */
export async function returnOrderStock(orderId: string): Promise<ReturnResult> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("return_order_stock", { p_order_id: orderId });
  if (error) throw new Error(`couldn't put the jars back: ${error.message}`);
  return data as ReturnResult;
}

function orderUrl(orderId: string) {
  return `${SITE_URL}/admin/orders/${orderId}`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

/**
 * The card failed, so the jars checkout held for the order go back. Never
 * throws: a failure tells Jesse instead.
 */
export async function returnStockAfterFailure(orderId: string, orderNumber: number): Promise<void> {
  try {
    await returnOrderStock(orderId);
  } catch (error) {
    console.error(`Stock: couldn't put back the jars for order #${orderNumber}:`, errorText(error));
    await alertOwner({
      key: `stock:return-failed:${orderNumber}`,
      title: `Order #${orderNumber}: jars not put back`,
      message: `The card failed for order #${orderNumber}, but the site couldn't add its jars back to the stock count (${errorText(error)}). Open the order and press "Put jars back".`,
      url: orderUrl(orderId),
      windowHours: 7 * 24,
    });
  }
}

/** The order's tracked products and their counts now. */
async function stockLevels(orderId: string): Promise<StockLevel[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("product_id, products(id, name, stock_count, low_stock_at)")
    .eq("order_id", orderId);
  if (error) throw new Error(`couldn't read the stock counts: ${error.message}`);
  const rows = (data ?? []) as unknown as {
    products: { id: number; name: string; stock_count: number | null; low_stock_at: number | null } | null;
  }[];
  return rows
    .map((row) => row.products)
    .filter((p): p is NonNullable<typeof p> => p !== null && p.stock_count !== null)
    .map((p) => ({ product_id: p.id, name: p.name, stock_count: p.stock_count, low_stock_at: p.low_stock_at }));
}

/**
 * Call once an order is marked paid. Makes sure its jars came off the
 * counts, and alerts Jesse when a count is at or below its alert level.
 * Never throws: the customer has paid, so a stock problem must not fail the
 * order. It tells Jesse instead.
 */
export async function stockAfterPaid(orderId: string, orderNumber: number): Promise<void> {
  try {
    // Normally "already": checkout took the jars before charging. An order
    // saved before stock counts existed, or one whose card failed and then
    // went through, takes them now, never below 0.
    const take = await takeOrderStock(orderId, true);
    if (take.status === "taken" && take.short.length > 0) {
      const lines = take.short
        .map((s) => `${s.name}: wanted ${s.wanted}, had ${s.available}`)
        .join("; ");
      await alertOwner({
        key: `stock:oversold:${orderNumber}`,
        title: `Order #${orderNumber}: not enough jars`,
        message: `Order #${orderNumber} is paid, but the stock count was short (${lines}). Check your shelf, then make the jars, refund part of the order, or contact the customer.`,
        url: orderUrl(orderId),
        windowHours: 7 * 24,
      });
    }

    for (const level of await stockLevels(orderId)) {
      const alert = lowStockAlert(level, orderNumber);
      if (alert) {
        await alertOwner({
          ...alert,
          url: `${SITE_URL}/admin/products/${level.product_id}/edit`,
          windowHours: 24,
        });
      }
    }
  } catch (error) {
    console.error(`Stock: couldn't check the jars for paid order #${orderNumber}:`, errorText(error));
    await alertOwner({
      key: "stock:paid-check-failed",
      title: "Stock counts may be off",
      message: `Order #${orderNumber} is paid, but the site couldn't check its jars against the stock counts (${errorText(error)}). Check the counts on the Products page.`,
      url: orderUrl(orderId),
    });
  }
}
