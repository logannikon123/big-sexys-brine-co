import { requireAuth } from "@/lib/supabase/auth-guard";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBanner } from "@/components/admin/orders/order-badges";
import { isOrdersDemo } from "@/app/admin/orders/order-data";
import { SalesFilterBar } from "@/components/admin/sales/sales-filters";
import { SalesSummaryTiles } from "@/components/admin/sales/sales-summary";
import { ProductSalesTable } from "@/components/admin/sales/product-sales-table";
import { CustomerTable } from "@/components/admin/sales/customer-table";
import { parseSalesFilters, rangeLabel } from "@/lib/admin/sales-filters";
import { loadSalesStats } from "@/lib/admin/sales-data";

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuth();
  const filters = parseSalesFilters(await searchParams);
  const { stats, error } = await loadSalesStats(filters);

  return (
    // Extra room on phones so the menu button doesn't cover the title.
    <div className="min-w-0 space-y-6 pt-8 lg:pt-0">
      {isOrdersDemo() && <DemoBanner />}
      <div>
        <h1 className="font-display text-2xl font-bold">Sales</h1>
        <p className="text-sm text-muted-foreground">
          Online orders that were paid for, with dates in Colorado time.
          Cancelled orders and full refunds don&apos;t count.
        </p>
      </div>

      <SalesFilterBar filters={filters} path="/admin/sales" />

      {error || !stats ? (
        <Card>
          <CardContent className="py-10 text-center text-red-300">
            {error}
          </CardContent>
        </Card>
      ) : stats.summary.orders === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-10 text-center text-muted-foreground">
            <p>No online sales in this period yet.</p>
            {stats.summary.fullyRefundedOrders > 0 && (
              <p className="text-sm">
                {stats.summary.fullyRefundedOrders === 1
                  ? "1 order"
                  : `${stats.summary.fullyRefundedOrders} orders`}{" "}
                refunded in full ({formatPrice(stats.summary.refundsCents)}).
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label={`Totals, ${rangeLabel(filters.range)}`}>
            <SalesSummaryTiles summary={stats.summary} />
          </section>
          <ProductSalesTable products={stats.products} filters={filters} />
          <CustomerTable customers={stats.customers} filters={filters} />
        </>
      )}
    </div>
  );
}
