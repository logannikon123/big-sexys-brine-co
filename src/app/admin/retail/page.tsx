import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { RetailLocation } from "@/types";
import { RetailSortableList } from "./retail-sortable-list";

export default async function AdminRetailPage() {
  await requireAuth();
  const supabase = await createClient();
  const { data: locations, error } = await supabase
    .from("retail_locations")
    .select("*")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Retail Locations</h1>
          <p className="text-sm text-muted-foreground">
            Stores that carry the jars, shown on the Find Us page above the events. Drag to
            reorder. Changes are saved automatically.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/retail/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Store
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          Retail locations aren&apos;t set up in the database yet.
        </p>
      ) : locations && locations.length > 0 ? (
        <RetailSortableList locations={locations as RetailLocation[]} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No stores yet. The Find Us page hides this section until you add one.
        </p>
      )}
    </div>
  );
}
