import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { DeliveryOriginForm } from "@/components/admin/delivery-origin-form";
import type {
  StorePrivateSettings,
  StoreSettings,
} from "@/lib/store-settings";

/** Postgres sends some number columns back as text. Null stays null. */
function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export default async function AdminStorePage() {
  await requireAuth();
  const supabase = await createClient();
  const [{ data: row }, { data: privateRow }] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
    // Admins can read this row; everyone else gets nothing back.
    supabase
      .from("store_private_settings")
      .select(
        "delivery_origin_address, delivery_origin_lat, delivery_origin_lon, delivery_origin_matched_address"
      )
      .eq("id", 1)
      .maybeSingle(),
  ]);

  // The distance columns arrive with a later database update than the table,
  // so wait for them before showing the form.
  const settings: StoreSettings | null =
    row && "delivery_max_miles" in row
      ? {
          ...row,
          shipping_states: row.shipping_states ?? [],
          box_length_in: Number(row.box_length_in),
          box_width_in: Number(row.box_width_in),
          box_height_in: Number(row.box_height_in),
          delivery_max_miles: Number(row.delivery_max_miles),
          delivery_step_miles: Number(row.delivery_step_miles),
          free_delivery_max_miles: numberOrNull(row.free_delivery_max_miles),
        }
      : null;

  const privateSettings: StorePrivateSettings | null = privateRow
    ? {
        delivery_origin_address: privateRow.delivery_origin_address ?? "",
        delivery_origin_lat: numberOrNull(privateRow.delivery_origin_lat),
        delivery_origin_lon: numberOrNull(privateRow.delivery_origin_lon),
        delivery_origin_matched_address:
          privateRow.delivery_origin_matched_address ?? null,
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
        <>
          <StoreSettingsForm settings={settings} />
          {privateSettings && (
            <DeliveryOriginForm settings={privateSettings} />
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Store settings aren&apos;t set up yet</CardTitle>
            <CardDescription>
              The database doesn&apos;t have the latest store settings yet.
              They arrive with the store settings database updates. Once those
              are applied, reload this page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
