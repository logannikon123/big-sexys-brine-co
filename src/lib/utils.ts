import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a price stored in cents, e.g. 1500 -> "$15.00". */
export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

/** Format whole-dollar prices without cents, e.g. 1000 -> "$10", 1050 -> "$10.50". */
export function formatPriceShort(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : formatPrice(cents)
}

/** A product can be ordered online when it is for sale online, in stock and has a price. */
export function canOrderOnline(product: {
  soldOnline?: boolean
  soldOut?: boolean
  priceCents?: number | null
}) {
  return product.soldOnline === true && product.soldOut !== true && product.priceCents != null
}

/**
 * Drop a price typed at the end of a size label, e.g. "16oz (1/2QT) $15" -> "16oz (1/2QT)".
 * The price has its own field now, so the size badge should show only the size.
 */
export function sizeLabel(size: string) {
  return size.replace(/\s*\$\d+(\.\d{1,2})?\s*$/, "")
}
