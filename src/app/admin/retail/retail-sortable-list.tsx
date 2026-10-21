"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EyeOff, Pencil } from "lucide-react";
import { SortableList } from "@/components/admin/sortable-list";
import type { RetailLocation } from "@/types";
import { updateRetailLocationOrder } from "../actions";
import { RetailDeleteButton } from "./retail-delete-button";

export function RetailSortableList({ locations }: { locations: RetailLocation[] }) {
  return (
    <SortableList
      items={locations}
      onReorder={updateRetailLocationOrder}
      renderItem={(location) => (
        <div className="flex items-center gap-4 py-2 pr-3">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="font-medium">{location.name}</span>
            {location.is_pickup_location && (
              <Badge className="bg-brand-gold text-brand-black">Pickup</Badge>
            )}
            {!location.is_visible && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5" />
                Hidden
              </span>
            )}
          </div>
          <span className="hidden sm:block text-sm text-muted-foreground w-64 truncate">
            {location.address}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/retail/${location.id}/edit`} aria-label={`Edit ${location.name}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <RetailDeleteButton id={location.id} name={location.name} />
          </div>
        </div>
      )}
    />
  );
}
