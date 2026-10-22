import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBanner } from "@/components/admin/orders/order-badges";
import { isOrdersDemo } from "@/app/admin/orders/order-data";
import { TaxCsvLink, TaxPeriodPicker, TaxReportView } from "@/components/admin/sales/tax-report";
import { parseTaxPeriod, periodLabel } from "@/lib/admin/tax-report-filters";
import { loadTaxReport } from "@/lib/admin/tax-report-data";

export default async function AdminTaxReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuth();
  const period = parseTaxPeriod(await searchParams);
  const { report, error } = await loadTaxReport(period);

  return (
    // Extra room on phones so the menu button doesn't cover the title.
    <div className="min-w-0 space-y-6 pt-8 lg:pt-0">
      {isOrdersDemo() && <DemoBanner />}
      <div className="space-y-2">
        <Link
          href="/admin/sales"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Sales
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Tax report</h1>
            <p className="text-sm text-muted-foreground">
              Local food tax by city and county, for filing sales tax returns.{" "}
              {periodLabel(period)}: orders paid in those dates (Colorado time) through
              Square&apos;s live system. Test orders never count.
            </p>
          </div>
          <TaxCsvLink period={period} />
        </div>
      </div>

      <TaxPeriodPicker period={period} />

      {error || !report ? (
        <Card>
          <CardContent className="py-10 text-center text-red-300">{error}</CardContent>
        </Card>
      ) : (
        <TaxReportView report={report} period={period} />
      )}
    </div>
  );
}
