import { cn } from "@/lib/utils";

// Colorado's cottage food law requires this notice wherever the jars are
// sold, online included. Show it anywhere people can buy: product pages,
// the cart and checkout. The wording is the point-of-sale placard text from
// C.R.S. 25-4-1614(3)(c); keep it exact.
export const COTTAGE_FOOD_NOTICE =
  "This product was produced in a home kitchen that is not subject to state licensure or inspection. This product is not intended for resale.";

interface CottageFoodNoticeProps {
  className?: string;
}

export function CottageFoodNotice({ className }: CottageFoodNoticeProps) {
  return (
    <p className={cn("text-xs leading-relaxed text-brand-cream/60", className)}>
      {COTTAGE_FOOD_NOTICE}
    </p>
  );
}
