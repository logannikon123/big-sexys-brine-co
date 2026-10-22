import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { RetailLocationForm } from "@/components/admin/retail-location-form";
import { notFound } from "next/navigation";
import type { RetailLocation } from "@/types";

export default async function EditRetailLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth();
  const supabase = await createClient();
  const { data: location } = await supabase
    .from("retail_locations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!location) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Edit Store</h1>
        <p className="text-sm text-muted-foreground">Update {location.name}</p>
      </div>
      <RetailLocationForm location={location as RetailLocation} />
    </div>
  );
}
