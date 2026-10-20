"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart } from "./CartProvider";
import { QuantityStepper } from "./QuantityStepper";
import { MAX_LINES, MAX_QTY_PER_LINE } from "@/lib/cart/store";

interface AddToCartProps {
  productId: number;
  productName: string;
}

export function AddToCart({ productId, productName }: AddToCartProps) {
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const router = useRouter();

  function handleAdd() {
    const result = add(productId, qty);
    if (!result.ok) {
      toast.error(
        `Your cart holds up to ${MAX_LINES} different jars. Take one out to add this one.`
      );
      return;
    }
    toast.success("Added to your cart", {
      description: result.capped
        ? `You now have ${MAX_QTY_PER_LINE} jars of ${productName}, the most we sell in one order.`
        : `${qty} ${qty === 1 ? "jar" : "jars"} of ${productName}`,
      action: { label: "View cart", onClick: () => router.push("/cart") },
    });
    setQty(1);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <QuantityStepper value={qty} onChange={setQty} productName={productName} />
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90 sm:flex-none"
      >
        Add to Cart
      </button>
    </div>
  );
}
