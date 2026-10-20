import { cn } from "@/lib/utils";

// Colorado's cottage food law requires this notice wherever the jars are
// sold, online included. Show it anywhere people can buy: product pages,
// the cart and checkout. Keep the wording exact.
export const COTTAGE_FOOD_NOTICE =
  "Made in a home kitchen that is not subject to state licensure or inspection. Not intended for resale.";

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
