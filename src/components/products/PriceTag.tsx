import { cn, formatPrice } from "@/lib/utils";

interface PriceTagProps {
  priceCents?: number | null;
  soldOut?: boolean;
  /** Classes for the wrapper, which holds the price and the sold out note. */
  className?: string;
  /** Classes for the price itself, e.g. to make it bigger. */
  priceClassName?: string;
}

/**
 * Shows a product's price, with a small "Sold out" note when the jar is out.
 * Shows nothing when the product has no price.
 */
export function PriceTag({ priceCents, soldOut, className, priceClassName }: PriceTagProps) {
  if (priceCents == null) return null;

  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("font-semibold text-brand-gold", priceClassName)}>
        {formatPrice(priceCents)}
      </span>
      {soldOut && <span className="text-xs text-brand-cream/50">Sold out</span>}
    </span>
  );
}
