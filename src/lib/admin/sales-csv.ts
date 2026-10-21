/**
 * Turns the sales stats into CSV files for a spreadsheet. Server code only.
 */

import "server-only";
import { fulfillmentLabel } from "@/components/admin/orders/order-flow";
import {
  denverDateString,
  type CustomerStats,
  type ProductStats,
} from "./sales-stats";

type Cell = string | number | null;

/**
 * One CSV cell. A spreadsheet runs text that starts with = + - @ (or a tab
 * or carriage return) as a formula, so such text gets a ' in front. Cells
 * with a comma, quote or line break go in quotes, with quotes doubled.
 */
export function csvCell(value: Cell): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to CSV text, with Windows line ends as the CSV standard asks. */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** 1234 cents -> "12.34", a plain number a spreadsheet can add up. */
function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function productsCsv(products: readonly ProductStats[]): string {
  return toCsv([
    ["Product", "Size", "Jars sold", "Orders", "Sales ($)", "Share of jar sales (%)"],
    ...products.map((p) => [
      p.name,
      p.size,
      p.units,
      p.orders,
      dollars(p.revenueCents),
      (p.share * 100).toFixed(1),
    ]),
  ]);
}

export function customersCsv(customers: readonly CustomerStats[]): string {
  return toCsv([
    [
      "Name",
      "Email",
      "Orders",
      "Total spent ($)",
      "Average order ($)",
      "First order",
      "Last order",
      "Favorite product",
      "Usual way",
    ],
    ...customers.map((c) => [
      c.name,
      c.email,
      c.orders,
      dollars(c.netCents),
      dollars(c.averageOrderCents),
      denverDateString(c.firstOrderAt),
      denverDateString(c.lastOrderAt),
      c.favoriteProduct,
      fulfillmentLabel(c.usualFulfillment),
    ]),
  ]);
}
