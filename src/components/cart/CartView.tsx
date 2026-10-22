"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCart } from "./CartProvider";
import { QuantityStepper } from "./QuantityStepper";
import { CottageFoodNotice } from "@/components/legal/CottageFoodNotice";
import {
  clearRemovedNotes,
  getRemovedSnapshot,
  getServerRemovedSnapshot,
  pruneCart,
  subscribeCart,
} from "@/lib/cart/store";
import { formatPrice, formatPriceShort } from "@/lib/utils";

/** What the cart page needs to know about each product. Prices come from the server. */
export interface CartProduct {
  id: number;
  name: string;
  slug: string;
  image: string;
  size: string;
  priceCents: number | null;
  /** For sale online, in stock and priced. */
  orderable: boolean;
}

interface CartViewProps {
  products: CartProduct[];
  /** Packing fee for shipped orders, or null if shipping is off. */
  packing: { jarsPerBox: number; feePerBoxCents: number } | null;
}

export function CartView({ products, packing }: CartViewProps) {
  const { items, ready, setQty, remove } = useCart();
  const removedIds = useSyncExternalStore(
    subscribeCart,
    getRemovedSnapshot,
    getServerRemovedSnapshot
  );

  const byId = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  // Take out jars that can't be ordered online any more. The store remembers
  // which ones, so the notes below can say why.
  useEffect(() => {
    if (!ready) return;
    pruneCart((id) => byId.get(id)?.orderable === true);
  }, [ready, items, byId]);

  // Forget the notes when the visitor leaves the cart page.
  useEffect(() => clearRemovedNotes, []);

  const lines = items.flatMap((item) => {
    const product = byId.get(item.productId);
    if (!product?.orderable || product.priceCents == null) return [];
    return [{ ...item, product, priceCents: product.priceCents }];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
  const jarCount = lines.reduce((sum, line) => sum + line.qty, 0);

  const notes = removedIds.map((id) => {
    const product = byId.get(id);
    return {
      id,
      text: product
        ? `${product.name} is sold out online, so we took it out of your cart.`
        : "A jar in your cart is no longer in our lineup, so we took it out.",
    };
  });

  if (!ready) {
    return <p className="text-brand-cream/60">Loading your cart...</p>;
  }

  return (
    <div className="space-y-8">
      {notes.length > 0 && (
        <ul
          role="status"
          className="space-y-2 rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-4 text-sm text-brand-cream"
        >
          {notes.map((note) => (
            <li key={note.id}>{note.text}</li>
          ))}
        </ul>
      )}

      {lines.length === 0 ? (
        <div className="space-y-4 rounded-xl border border-brand-brown/20 bg-card p-8 text-center">
          <p className="text-lg text-brand-cream">Your cart is empty.</p>
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90"
          >
            See the Lineup
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <ul className="divide-y divide-brand-brown/30 rounded-xl border border-brand-brown/20 bg-card lg:col-span-2">
            {lines.map((line) => (
              <li key={line.productId} className="flex gap-4 p-4 sm:p-5">
                <Link
                  href={`/products/${line.product.slug}`}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-brown/20 sm:h-24 sm:w-24"
                >
                  {line.product.image && (
                    <Image
                      src={line.product.image}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${line.product.slug}`}
                        className="font-display text-lg font-semibold text-brand-cream hover:text-brand-orange"
                      >
                        {line.product.name}
                      </Link>
                      <p className="text-sm text-brand-cream/60">
                        {line.product.size ? `${line.product.size}, ` : ""}
                        {formatPrice(line.priceCents)} each
                      </p>
                    </div>
                    <p className="font-semibold text-brand-gold tabular-nums">
                      {formatPrice(line.priceCents * line.qty)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <QuantityStepper
                      value={line.qty}
                      onChange={(qty) => setQty(line.productId, qty)}
                      productName={line.product.name}
                    />
                    <button
                      type="button"
                      onClick={() => remove(line.productId)}
                      aria-label={`Remove ${line.product.name} from your cart`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-brand-cream/60 transition-colors hover:bg-white/5 hover:text-brand-orange"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="h-fit space-y-4 rounded-xl border border-brand-brown/20 bg-card p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-brand-cream/80">
                Subtotal ({jarCount} {jarCount === 1 ? "jar" : "jars"})
              </span>
              <span className="font-display text-2xl font-bold text-brand-gold tabular-nums">
                {formatPrice(subtotal)}
              </span>
            </div>
            <p className="text-sm text-brand-cream/60">
              Delivery, shipping, packing and any local tax are worked out at checkout.
            </p>
            {packing && packing.feePerBoxCents > 0 && (
              <p className="text-sm text-brand-cream/60">
                Shipping adds a {formatPriceShort(packing.feePerBoxCents)} packing fee per
                box of {packing.jarsPerBox} {packing.jarsPerBox === 1 ? "jar" : "jars"}.
              </p>
            )}
            <Link
              href="/checkout"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90"
            >
              Checkout
            </Link>
            <p className="text-sm text-brand-cream/60">
              See how{" "}
              <Link href="/shipping" className="underline hover:text-brand-orange">
                shipping, delivery and pickup
              </Link>{" "}
              work, and our{" "}
              <Link href="/refunds" className="underline hover:text-brand-orange">
                refund policy
              </Link>
              .
            </p>
            <CottageFoodNotice />
          </div>
        </div>
      )}
    </div>
  );
}
