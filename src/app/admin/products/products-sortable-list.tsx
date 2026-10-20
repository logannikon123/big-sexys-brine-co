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
  sort_order: number;
  created_at: string;
  updated_at: string;
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
          {product.sold_out ? (
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
