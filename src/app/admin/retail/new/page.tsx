import { requireAuth } from "@/lib/supabase/auth-guard";
import { RetailLocationForm } from "@/components/admin/retail-location-form";

export default async function NewRetailLocationPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">New Store</h1>
        <p className="text-sm text-muted-foreground">
          Add a store that carries the jars. It shows on the Find Us page.
        </p>
      </div>
      <RetailLocationForm />
    </div>
  );
}
