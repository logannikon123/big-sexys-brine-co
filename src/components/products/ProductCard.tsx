import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { HeatIndicator } from "./HeatIndicator";
import { PriceTag } from "./PriceTag";
import type { Product } from "@/types";
import { cn, sizeLabel } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        "group block bg-card rounded-xl border border-brand-brown/20 overflow-hidden hover:border-brand-orange/50 transition-all duration-300 hover:shadow-xl hover:shadow-brand-orange/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-brand-black",
        className
      )}
    >
      <div className="aspect-square relative bg-brand-brown/10 overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <Badge
          className="absolute top-3 right-3 bg-brand-orange/90 text-white text-xs border-0 z-10"
        >
          {sizeLabel(product.size)}
        </Badge>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-brand-cream group-hover:text-brand-orange transition-colors">
            {product.name}
          </h3>
          <PriceTag
            priceCents={product.priceCents}
            soldOut={product.soldOut}
            className="shrink-0 flex-col items-end gap-0 pt-0.5"
            priceClassName="text-lg"
          />
        </div>
        <p className="text-sm text-brand-cream/60 italic">{product.tagline}</p>
        <div className="flex items-center justify-between pt-1">
          <Badge variant="outline" className="text-xs border-brand-green/40 text-brand-green">
            {product.category}
          </Badge>
          <HeatIndicator level={product.heat} size={14} />
        </div>
      </div>
    </Link>
  );
}
