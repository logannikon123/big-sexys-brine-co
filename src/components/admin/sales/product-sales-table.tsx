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
import type { ProductStats } from "@/lib/admin/sales-stats";
import { salesHref, type SalesFilters } from "@/lib/admin/sales-filters";
import { CsvLink } from "./sales-filters";
import { SortLink } from "./sort-link";

function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

export function ProductSalesTable({
  products,
  filters,
}: {
  products: ProductStats[];
  filters: SalesFilters;
}) {
  const sortHref = (productSort: SalesFilters["productSort"]) =>
    `${salesHref("/admin/sales", filters, { productSort })}#products`;

  return (
    <Card id="products" className="scroll-mt-6 gap-4">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Sales by product</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Jar prices only, before tax, fees and refunds.
          </p>
        </div>
        <CsvLink kind="products" filters={filters}>
          Download CSV
        </CsvLink>
      </CardHeader>
      <CardContent className="px-0 sm:px-2">
        {products.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            No jars sold in this period.
          </p>
        ) : (
          <Table className="min-w-[36rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Product</TableHead>
                <TableHead className="text-right">
                  <SortLink
                    href={sortHref("units")}
                    active={filters.productSort === "units"}
                  >
                    Jars sold
                  </SortLink>
                </TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">
                  <SortLink
                    href={sortHref("revenue")}
                    active={filters.productSort === "revenue"}
                  >
                    Sales
                  </SortLink>
                </TableHead>
                <TableHead className="w-40 pr-4">Share of sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.key}>
                  <TableCell className="pl-4">
                    <span className="font-medium">{p.name}</span>
                    {p.size && (
                      <span className="block text-xs text-muted-foreground">
                        {p.size}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.units}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.orders}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(p.revenueCents)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-orange"
                          style={{ width: `${Math.max(p.share * 100, 0)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                        {percent(p.share)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
