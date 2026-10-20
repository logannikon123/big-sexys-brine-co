import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FoodTaxRatesTable } from "@/components/admin/food-tax-rates-table";
import type { FoodTaxKind, FoodTaxRate } from "@/lib/food-tax-rates";

const KIND_ORDER: Record<FoodTaxKind, number> = { county: 0, city: 1, district: 2 };

export default async function AdminTaxPage() {
  await requireAuth();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_tax_rates")
    .select(
      "id, kind, name, census_geoid, taxes_food, food_rate_bps, confirmed, source, notes, updated_at"
    );

  const rows: FoodTaxRate[] | null = data
    ? (data as FoodTaxRate[])
        .map((row) => ({ ...row, id: Number(row.id) }))
        .sort(
          (a, b) =>
            KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name)
        )
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Sales tax on food</h1>
        <p className="text-sm text-muted-foreground">
          The local tax each county, city and special district charges on
          food. Colorado&apos;s state tax doesn&apos;t apply to food for home
          use.
        </p>
      </div>
      {rows ? (
        <FoodTaxRatesTable rows={rows} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tax rates aren&apos;t set up yet</CardTitle>
            <CardDescription>
              The database doesn&apos;t have the tax rates table yet. It
              arrives with the food tax database update. Once that is applied,
              reload this page.
              {error?.message ? ` (Database message: ${error.message})` : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
