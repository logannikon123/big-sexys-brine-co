/**
 * The choices on the admin sales page, read from and written to the address
 * (?range=30d&tests=1&products=units&customers=last). Keeping them in the
 * address means the page works without any browser code, and a link or a
 * download carries the same choices.
 */

import {
  CUSTOMER_SORTS,
  PRODUCT_SORTS,
  SALES_RANGES,
  type CustomerSort,
  type ProductSort,
  type SalesRangeKey,
} from "./sales-stats";

export interface SalesFilters {
  range: SalesRangeKey;
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

/** The choices in the address. Anything missing or unknown gets the default. */
export function parseSalesFilters(params: Params | URLSearchParams): SalesFilters {
  const get = (name: string) =>
    params instanceof URLSearchParams ? (params.get(name) ?? undefined) : first(params[name]);
  return {
    range: pick(get("range"), SALES_RANGES.map((r) => r.key), DEFAULT_FILTERS.range),
    includeTests: get("tests") === "1",
    productSort: pick(get("products"), PRODUCT_SORTS, DEFAULT_FILTERS.productSort),
    customerSort: pick(get("customers"), CUSTOMER_SORTS, DEFAULT_FILTERS.customerSort),
  };
}

/** The query string for a set of choices, leaving out the defaults. */
export function salesQuery(filters: SalesFilters): string {
  const q = new URLSearchParams();
  if (filters.range !== DEFAULT_FILTERS.range) q.set("range", filters.range);
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
  return `${path}${salesQuery({ ...filters, ...change })}`;
}

export function rangeLabel(range: SalesRangeKey): string {
  return SALES_RANGES.find((r) => r.key === range)?.label ?? "";
}
