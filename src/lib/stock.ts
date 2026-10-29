/**
 * Stock counts: the rules shared by checkout, the admin and the public pages.
 * No database calls here, so the rules are easy to test. The counting itself
 * happens in the database (take_order_stock and return_order_stock, see the
 * product_stock migration), called from src/lib/orders/stock.ts.
 *
 * A product's stock_count is null when Jesse doesn't track it. Then only the
 * sold_out switch stops orders, as before stock counts existed.
 */

/** The public pages say "Only N left" below this many jars. */
export const FEW_LEFT_BELOW = 5;

/** True when the product can't be ordered at all: switched off, or none left. */
export function isOutOfStock(soldOut: boolean, stockCount: number | null): boolean {
  return soldOut || stockCount === 0;
}

/** True when a tracked product has fewer jars than the cart wants. */
export function isShort(stockCount: number | null, qty: number): boolean {
  return stockCount !== null && stockCount < qty;
}

/** N for "Only N left", or null when there are plenty or the count isn't tracked. */
export function fewLeft(stockCount: number | null): number | null {
  return stockCount !== null && stockCount > 0 && stockCount < FEW_LEFT_BELOW ? stockCount : null;
}

/** What the customer reads when the count is lower than their cart. */
export function shortMessage(name: string, available: number): string {
  if (available <= 0) return `${name} is sold out.`;
  return available === 1
    ? `Only 1 jar of ${name} is left. Change your cart to 1 jar.`
    : `Only ${available} jars of ${name} are left. Change your cart to ${available} or fewer.`;
}

/** A tracked product's count after an order, as the database reports it. */
export interface StockLevel {
  product_id: number;
  name: string;
  stock_count: number | null;
  low_stock_at: number | null;
}

export interface StockAlert {
  /** One alert key per product and kind, so each product has its own limit. */
  key: string;
  title: string;
  message: string;
}

function jarWord(count: number): string {
  return count === 1 ? "1 jar" : `${count} jars`;
}

/**
 * The alert for a count that has dropped to its alert level or below, or
 * null. At 0 the product is sold out, which gets its own key, so an earlier
 * "running low" alert can't hold it back.
 */
export function lowStockAlert(level: StockLevel, orderNumber: number): StockAlert | null {
  const count = level.stock_count;
  if (count === null) return null;
  if (count === 0) {
    return {
      key: `stock:sold-out:${level.product_id}`,
      title: `${level.name} is sold out`,
      message: `Order #${orderNumber} took the last jar of ${level.name}, so the site now shows it as sold out. When you have more, type the new count into "Jars in stock" on the product page.`,
    };
  }
  if (level.low_stock_at === null || count > level.low_stock_at) return null;
  return {
    key: `stock:low:${level.product_id}`,
    title: `${level.name}: ${jarWord(count)} left`,
    message: `After order #${orderNumber}, ${level.name} is down to ${jarWord(count)} (you asked to hear at ${level.low_stock_at}).`,
  };
}

/** A line the database couldn't fill: it had `available`, the order wanted `wanted`. */
export interface ShortLine {
  product_id: number;
  name: string;
  available: number;
  wanted: number;
}

/**
 * What the admin product form sends for the stock count. On an existing
 * product the count is sent only when Jesse changed it, so saving the form
 * can't put back jars that orders took while it was open.
 *
 * @param typed what is in the "Jars in stock" box ("" for don't track)
 * @param loaded the count when the form opened (undefined for a new product)
 * @returns the count to save, null for "don't track", or undefined to leave it alone
 */
export function stockCountToSave(typed: string, loaded: number | null | undefined): number | null | undefined {
  const value = parseCount(typed);
  if (value === undefined) return undefined;
  if (loaded !== undefined && value === loaded) return undefined;
  return value;
}

/**
 * A count typed into the admin form: null for blank, undefined when it isn't
 * a whole number of 0 or more.
 */
export function parseCount(typed: string): number | null | undefined {
  const text = typed.trim();
  if (text === "") return null;
  if (!/^\d+$/.test(text)) return undefined;
  const n = Number(text);
  return Number.isSafeInteger(n) && n <= 2_147_483_647 ? n : undefined;
}
