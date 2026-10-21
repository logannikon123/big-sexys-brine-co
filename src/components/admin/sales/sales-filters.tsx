import Link from "next/link";
import { Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { SALES_RANGES } from "@/lib/admin/sales-stats";
import { salesHref, type SalesFilters } from "@/lib/admin/sales-filters";

const PILL =
  "flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors";
const PILL_ON = "border-brand-orange bg-brand-orange/15 text-brand-orange";
const PILL_OFF =
  "border-border text-muted-foreground hover:bg-muted hover:text-foreground";

/** The date range pills and the test orders switch. Plain links, no browser code. */
export function SalesFilterBar({
  filters,
  path,
}: {
  filters: SalesFilters;
  /** The page the links lead back to. */
  path: string;
}) {
  return (
    <div className="space-y-3">
      <nav
        aria-label="Date range"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {SALES_RANGES.map((r) => (
          <Link
            key={r.key}
            href={salesHref(path, filters, { range: r.key })}
            aria-current={r.key === filters.range ? "page" : undefined}
            className={cn(PILL, r.key === filters.range ? PILL_ON : PILL_OFF)}
          >
            {r.label}
          </Link>
        ))}
      </nav>
      <Link
        href={salesHref(path, filters, { includeTests: !filters.includeTests })}
        role="switch"
        aria-checked={filters.includeTests}
        className="inline-flex min-h-11 items-center gap-3 rounded-md pr-2 text-sm"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
            filters.includeTests
              ? "border-brand-orange bg-brand-orange text-white"
              : "border-muted-foreground"
          )}
        >
          {filters.includeTests && <Check className="h-4 w-4" />}
        </span>
        <span>
          Include test orders
          <span className="block text-xs text-muted-foreground">
            Orders paid through Square&apos;s test system. No money moved.
          </span>
        </span>
      </Link>
    </div>
  );
}

/** A link that downloads one of the sales CSV files for the current choices. */
export function CsvLink({
  kind,
  filters,
  children,
}: {
  kind: "products" | "customers";
  filters: SalesFilters;
  children: React.ReactNode;
}) {
  return (
    <a
      href={salesHref(`/admin/sales/export/${kind}`, filters)}
      download
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
    >
      <Download className="h-4 w-4" />
      {children}
    </a>
  );
}
