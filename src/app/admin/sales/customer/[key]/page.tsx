import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBanner } from "@/components/admin/orders/order-badges";
import { isOrdersDemo } from "@/app/admin/orders/order-data";
import { SalesFilterBar } from "@/components/admin/sales/sales-filters";
import { CustomerOrders } from "@/components/admin/sales/customer-orders";
import { parseSalesFilters, salesHref } from "@/lib/admin/sales-filters";
import { loadSalesStats } from "@/lib/admin/sales-data";

/** Customer codes are 16 hex characters (see customerKey in sales-stats.ts). */
const KEY_PATTERN = /^[0-9a-f]{16}$/;

export default async function AdminSalesCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuth();
  const { key } = await params;
  if (!KEY_PATTERN.test(key)) notFound();
  const filters = parseSalesFilters(await searchParams);
  const { stats, error } = await loadSalesStats(filters);
  const customer = stats?.customers.find((c) => c.key === key) ?? null;

  return (
    // Extra room on phones so the menu button doesn't cover the back link.
    <div className="min-w-0 space-y-6 pt-8 lg:pt-0">
      {isOrdersDemo() && <DemoBanner />}
      <div className="space-y-3">
        <Link
          href={`${salesHref("/admin/sales", filters)}#customers`}
          className="inline-flex h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All sales
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold">
            {customer?.name ?? "Customer"}
          </h1>
          {customer && (
            <p className="truncate text-sm text-muted-foreground">
              {customer.email}
            </p>
          )}
        </div>
      </div>

      <SalesFilterBar filters={filters} path={`/admin/sales/customer/${key}`} />

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-red-300">
            {error}
          </CardContent>
        </Card>
      ) : customer ? (
        <CustomerOrders customer={customer} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No sales to this customer in this period. Try All time.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
