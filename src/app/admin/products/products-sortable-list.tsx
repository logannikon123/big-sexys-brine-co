"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { ProductDeleteButton } from "./product-delete-button";
import { SortableList } from "@/components/admin/sortable-list";
import { updateProductOrder } from "../actions";

interface Product {
  id: number;
  name: string;
  slug: string;
  size: string;
  tagline: string;
  description: string;
  ingredients: string[];
  heat: number;
  category: string;
  image_url: string | null;
  featured: boolean;
  price_cents: number | null;
  sold_online: boolean;
  sold_out: boolean;
  stock_count: number | null;
  low_stock_at: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** "12 jars", amber at or below the warning level, red at 0. Blank when not tracked. */
function StockCount({ count, lowAt }: { count: number | null; lowAt: number | null }) {
  if (count === null) {
    return <span className="text-sm w-20 text-right text-muted-foreground">Not tracked</span>;
  }
  const tone =
    count === 0 ? "text-destructive" : lowAt !== null && count <= lowAt ? "text-amber-500" : "";
  return (
    <span className={`text-sm w-20 text-right tabular-nums ${tone}`}>
      {count === 1 ? "1 jar" : `${count} jars`}
    </span>
  );
}

export function ProductsSortableList({ products }: { products: Product[] }) {
  return (
    <SortableList
      items={products}
      onReorder={updateProductOrder}
      renderItem={(product) => (
        <div className="flex items-center gap-4 py-2 pr-3">
          <div className="flex-1 min-w-0">
            <span className="font-medium">{product.name}</span>
          </div>
          <Badge variant="secondary">{product.category}</Badge>
          <span className="text-sm text-muted-foreground w-16 text-center">
            {product.size}
          </span>
          <span className="text-sm w-16 text-right tabular-nums">
            {product.price_cents != null ? formatPrice(product.price_cents) : "No price"}
          </span>
          <StockCount count={product.stock_count ?? null} lowAt={product.low_stock_at ?? null} />
          {product.sold_out || product.stock_count === 0 ? (
            <Badge variant="destructive">Sold out</Badge>
          ) : product.sold_online ? (
            <Badge variant="outline">Online</Badge>
          ) : null}
          <span className="text-sm w-16 text-center">
            {"🔥".repeat(product.heat)}
            {product.heat === 0 && (
              <span className="text-muted-foreground">None</span>
            )}
          </span>
          {product.featured && (
            <Badge className="bg-brand-gold text-brand-black">Featured</Badge>
          )}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/products/${product.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <ProductDeleteButton id={product.id} name={product.name} />
          </div>
        </div>
      )}
    />
  );
}
