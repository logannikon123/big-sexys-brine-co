import Link from "next/link";
import { Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { SALES_RANGES, denverDateString } from "@/lib/admin/sales-stats";
import { DEFAULT_FILTERS, salesHref, type SalesFilters } from "@/lib/admin/sales-filters";

const PILL =
  "flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors";
const PILL_ON = "border-brand-orange bg-brand-orange/15 text-brand-orange";
const PILL_OFF =
  "border-border text-muted-foreground hover:bg-muted hover:text-foreground";

const DATE_INPUT =
  "h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";

/**
 * Pick any two dates. A plain form: submitting it reloads the page with
 * ?range=custom&from=...&to=..., keeping the other choices.
 */
function CustomRangeForm({ filters, path }: { filters: SalesFilters; path: string }) {
  const today = denverDateString(new Date().toISOString());
  const on = filters.range === "custom";
  return (
    <form
      method="get"
      action={path}
      aria-label="Custom date range"
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-lg border p-3",
        on ? "border-brand-orange" : "border-border"
      )}
    >
      <input type="hidden" name="range" value="custom" />
      {filters.includeTests && <input type="hidden" name="tests" value="1" />}
      {filters.productSort !== DEFAULT_FILTERS.productSort && (
        <input type="hidden" name="products" value={filters.productSort} />
      )}
      {filters.customerSort !== DEFAULT_FILTERS.customerSort && (
        <input type="hidden" name="customers" value={filters.customerSort} />
      )}
      <span className="w-full text-sm font-medium">Custom dates</span>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        From
        <input
          type="date"
          name="from"
          required
          max={today}
          defaultValue={on ? filters.from : undefined}
          className={DATE_INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        To
        <input
          type="date"
          name="to"
          required
          max={today}
          defaultValue={on ? filters.to : today}
          className={DATE_INPUT}
        />
      </label>
      <button
        type="submit"
        className={cn(PILL, on ? PILL_ON : "border-brand-orange bg-brand-orange text-white hover:bg-brand-orange/90")}
      >
        Apply
      </button>
    </form>
  );
}

/** The date range pills, a custom range, and the test orders switch. No browser code. */
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
      <CustomRangeForm filters={filters} path={path} />
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
