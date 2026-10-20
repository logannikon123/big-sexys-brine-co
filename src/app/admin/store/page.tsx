import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import type { StoreSettings } from "@/lib/store-settings";

export default async function AdminStorePage() {
  await requireAuth();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("store_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  // Postgres sends some number columns back as text, so turn them into numbers.
  const settings: StoreSettings | null = row
    ? {
        ...row,
        delivery_zip_codes: row.delivery_zip_codes ?? [],
        shipping_states: row.shipping_states ?? [],
        box_length_in: Number(row.box_length_in),
        box_width_in: Number(row.box_width_in),
        box_height_in: Number(row.box_height_in),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Store settings</h1>
        <p className="text-sm text-muted-foreground">
          How customers can get their order, what it costs, and whether the
          online store is open
        </p>
      </div>
      {settings ? (
        <StoreSettingsForm settings={settings} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Store settings aren&apos;t set up yet</CardTitle>
            <CardDescription>
              The database doesn&apos;t have a store settings table yet. It
              arrives with the store settings database update. Once that is
              applied, reload this page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
