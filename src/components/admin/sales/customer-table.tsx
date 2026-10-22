import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fulfillmentLabel } from "@/components/admin/orders/order-flow";
import { STORE_TIME_ZONE, type CustomerStats } from "@/lib/admin/sales-stats";
import { salesHref, type SalesFilters } from "@/lib/admin/sales-filters";
import { CsvLink } from "./sales-filters";
import { SortLink } from "./sort-link";

/** "Oct 19, 2026" in Colorado time. */
export function formatSalesDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function customerHref(customer: CustomerStats, filters: SalesFilters): string {
  return salesHref(`/admin/sales/customer/${customer.key}`, filters);
}

export function CustomerTable({
  customers,
  filters,
}: {
  customers: CustomerStats[];
  filters: SalesFilters;
}) {
  const sortHref = (customerSort: SalesFilters["customerSort"]) =>
    `${salesHref("/admin/sales", filters, { customerSort })}#customers`;

  return (
    <Card id="customers" className="scroll-mt-6 gap-4">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Customers</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            One row per email address. Tap a name to see their orders.
          </p>
        </div>
        <CsvLink kind="customers" filters={filters}>
          Download CSV
        </CsvLink>
      </CardHeader>
      <CardContent className="px-0 sm:px-2">
        <Table className="min-w-[56rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Customer</TableHead>
              <TableHead className="text-right">
                <SortLink
                  href={sortHref("orders")}
                  active={filters.customerSort === "orders"}
                >
                  Orders
                </SortLink>
              </TableHead>
              <TableHead className="text-right">
                <SortLink
                  href={sortHref("spent")}
                  active={filters.customerSort === "spent"}
                >
                  Total spent
                </SortLink>
              </TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead>First order</TableHead>
              <TableHead>
                <SortLink
                  href={sortHref("last")}
                  active={filters.customerSort === "last"}
                >
                  Last order
                </SortLink>
              </TableHead>
              <TableHead>Favorite</TableHead>
              <TableHead>Usual way</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.key}>
                <TableCell className="max-w-56 pl-4">
                  <Link
                    href={customerHref(c, filters)}
                    className="block truncate font-medium hover:text-brand-orange hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.email}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(c.netCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(c.averageOrderCents)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatSalesDate(c.firstOrderAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatSalesDate(c.lastOrderAt)}
                </TableCell>
                <TableCell className="max-w-48 truncate">
                  {c.favoriteProduct ?? ""}
                </TableCell>
                <TableCell>{fulfillmentLabel(c.usualFulfillment)}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Link
                    href={customerHref(c, filters)}
                    aria-label={`Orders from ${c.name}`}
                    className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-brand-orange hover:bg-muted"
                  >
                    Orders
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
