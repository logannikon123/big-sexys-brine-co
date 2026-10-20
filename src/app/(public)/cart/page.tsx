import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { CartView, type CartProduct } from "@/components/cart/CartView";
import { getOrderingAvailable, getProducts, getStoreSettings } from "@/lib/data";
import { canOrderOnline, sizeLabel } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false },
};

export const revalidate = 60;

export default async function CartPage() {
  const orderingAvailable = await getOrderingAvailable();

  return (
    <section className="pt-28 pb-24">
      <Container className="max-w-5xl">
        <h1 className="mb-8 font-display text-4xl font-bold text-brand-cream sm:text-5xl">
          Your Cart
        </h1>
        {orderingAvailable ? <OpenCart /> : <ClosedCart />}
      </Container>
    </section>
  );
}

async function OpenCart() {
  const [allProducts, settings] = await Promise.all([getProducts(), getStoreSettings()]);
  // Send only what the cart shows. Prices always come from here, never from
  // the browser's saved cart.
  const products: CartProduct[] = allProducts.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    image: product.image,
    size: sizeLabel(product.size),
    priceCents: product.priceCents ?? null,
    orderable: canOrderOnline(product),
  }));
  const packing = settings?.shipping_enabled
    ? {
        jarsPerBox: settings.jars_per_box,
        feePerBoxCents: settings.packing_fee_per_box_cents,
      }
    : null;

  return <CartView products={products} packing={packing} />;
}

function ClosedCart() {
  return (
    <div className="space-y-4 rounded-xl border border-brand-brown/20 bg-card p-8 text-center">
      <p className="text-lg text-brand-cream">
        Online ordering opens soon. Find us at our next market.
      </p>
      <Link
        href="/events"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90"
      >
        Find Us Live
      </Link>
    </div>
  );
}
