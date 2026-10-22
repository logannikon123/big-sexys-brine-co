import { cn } from "@/lib/utils";

// Colorado's cottage food law requires this notice wherever the jars are
// sold, online included. Show it anywhere people can buy: product pages,
// the cart and checkout. The wording is the point-of-sale placard text from
// C.R.S. 25-4-1614(3)(c); keep it exact.
export const COTTAGE_FOOD_NOTICE =
  "This product was produced in a home kitchen that is not subject to state licensure or inspection. This product is not intended for resale.";

// PLACEHOLDER: our cottage food registration number from CDPHE (the Colorado
// health department). From January 1, 2027 (HB26-1033), jar labels and the
// website must show it. Type it between the quotes once CDPHE issues it.
// While it is blank, the notice shows no number.
export const CDPHE_REGISTRATION_NUMBER: string = "";

// The same law asks for a link to CDPHE's cottage food page.
export const CDPHE_COTTAGE_FOODS_URL = "https://cdphe.colorado.gov/dehs/cottage-foods";

interface CottageFoodNoticeProps {
  className?: string;
}

export function CottageFoodNotice({ className }: CottageFoodNoticeProps) {
  const registration = CDPHE_REGISTRATION_NUMBER.trim();
  return (
    <div className={cn("space-y-1 text-xs leading-relaxed text-brand-cream/60", className)}>
      <p>{COTTAGE_FOOD_NOTICE}</p>
      {registration !== "" && (
        <p>Colorado cottage food registration number: {registration}</p>
      )}
      <p>
        Colorado cottage food rules:{" "}
        <a
          href={CDPHE_COTTAGE_FOODS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-brand-orange"
        >
          cdphe.colorado.gov/dehs/cottage-foods
        </a>
      </p>
    </div>
  );
}
