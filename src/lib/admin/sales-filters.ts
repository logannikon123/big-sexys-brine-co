/**
 * The choices on the admin sales page, read from and written to the address
 * (?range=30d&tests=1&products=units&customers=last, or
 * ?range=custom&from=2026-10-01&to=2026-10-15). Keeping them in the address
 * means the page works without any browser code, and a link or a download
 * carries the same choices.
 */

import {
  CUSTOMER_SORTS,
  PRODUCT_SORTS,
  SALES_RANGES,
  customRangeBounds,
  isIsoDate,
  rangeStart,
  type CustomerSort,
  type ProductSort,
  type SalesRangeKey,
} from "./sales-stats";

/** A preset range, or "custom" with its own from and to dates. */
export type SalesRange = SalesRangeKey | "custom";

export interface SalesFilters {
  range: SalesRange;
  /** For a custom range: the first and last Colorado dates, YYYY-MM-DD. */
  from?: string;
  to?: string;
  includeTests: boolean;
  productSort: ProductSort;
  customerSort: CustomerSort;
}

export const DEFAULT_FILTERS: SalesFilters = {
  range: "30d",
  includeTests: false,
  productSort: "revenue",
  customerSort: "spent",
};

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * The choices in the address. Anything missing or unknown gets the default.
 * A custom range needs two real dates; if they're the wrong way round they
 * are swapped, and if either is missing the default range is used.
 */
export function parseSalesFilters(params: Params | URLSearchParams): SalesFilters {
  const get = (name: string) =>
    params instanceof URLSearchParams ? (params.get(name) ?? undefined) : first(params[name]);
  const base = {
    includeTests: get("tests") === "1",
    productSort: pick(get("products"), PRODUCT_SORTS, DEFAULT_FILTERS.productSort),
    customerSort: pick(get("customers"), CUSTOMER_SORTS, DEFAULT_FILTERS.customerSort),
  };

  if (get("range") === "custom") {
    const from = get("from") ?? "";
    const to = get("to") ?? "";
    if (isIsoDate(from) && isIsoDate(to)) {
      const [a, b] = from <= to ? [from, to] : [to, from];
      return { ...base, range: "custom", from: a, to: b };
    }
    return { ...base, range: DEFAULT_FILTERS.range };
  }

  return {
    ...base,
    range: pick(get("range"), SALES_RANGES.map((r) => r.key), DEFAULT_FILTERS.range as SalesRangeKey),
  };
}

/** The query string for a set of choices, leaving out the defaults. */
export function salesQuery(filters: SalesFilters): string {
  const q = new URLSearchParams();
  if (filters.range !== DEFAULT_FILTERS.range) q.set("range", filters.range);
  if (filters.range === "custom" && filters.from && filters.to) {
    q.set("from", filters.from);
    q.set("to", filters.to);
  }
  if (filters.includeTests) q.set("tests", "1");
  if (filters.productSort !== DEFAULT_FILTERS.productSort) q.set("products", filters.productSort);
  if (filters.customerSort !== DEFAULT_FILTERS.customerSort) q.set("customers", filters.customerSort);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** A link to a sales page with some choices changed. */
export function salesHref(
  path: string,
  filters: SalesFilters,
  change: Partial<SalesFilters> = {}
): string {
  const next = { ...filters, ...change };
  // Picking a preset range drops the custom dates.
  if (next.range !== "custom") {
    delete next.from;
    delete next.to;
  }
  return `${path}${salesQuery(next)}`;
}

/** When the chosen range starts and ends. Null start means all time; null end means up to now. */
export function rangeBounds(filters: SalesFilters, now: Date = new Date()): { start: Date | null; end: Date | null } {
  if (filters.range === "custom" && filters.from && filters.to) {
    return customRangeBounds(filters.from, filters.to);
  }
  return { start: rangeStart(filters.range as SalesRangeKey, now), end: null };
}

/** "Oct 1, 2026" from "2026-10-01". */
function shortDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function rangeLabel(filters: SalesFilters): string {
  if (filters.range === "custom" && filters.from && filters.to) {
    return filters.from === filters.to
      ? shortDate(filters.from)
      : `${shortDate(filters.from)} to ${shortDate(filters.to)}`;
  }
  return SALES_RANGES.find((r) => r.key === filters.range)?.label ?? "";
}

/** A short name for the range, for download file names: "30d" or "2026-10-01_to_2026-10-15". */
export function rangeFileTag(filters: SalesFilters): string {
  return filters.range === "custom" && filters.from && filters.to
    ? `${filters.from}_to_${filters.to}`
    : filters.range;
}
