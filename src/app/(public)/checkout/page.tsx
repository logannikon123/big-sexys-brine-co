import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { CheckoutForm, type CheckoutProduct } from "@/components/checkout/CheckoutForm";
import { getOrderingAvailable, getProducts, getStoreSettings } from "@/lib/data";
import { canOrderOnline, sizeLabel } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export const revalidate = 60;

/**
 * Checkout: the customer picks pickup, local delivery or shipping, and sees
 * the full price from the quote route. Hidden, like the cart, until the store
 * opens. Payment is added in a later change.
 */
export default async function CheckoutPage() {
  const orderingAvailable = await getOrderingAvailable();

  return (
    <section className="pt-28 pb-24">
      <Container className="max-w-5xl">
        <h1 className="mb-8 font-display text-4xl font-bold text-brand-cream sm:text-5xl">
          Checkout
        </h1>
        {orderingAvailable ? <OpenCheckout /> : <ClosedCheckout />}
      </Container>
    </section>
  );
}

async function OpenCheckout() {
  const [allProducts, settings] = await Promise.all([getProducts(), getStoreSettings()]);
  if (!settings) return <ClosedCheckout />;

  // Names and prices for the order summary. The quote route works out the
  // real bill from the database; these are only for display.
  const products: CheckoutProduct[] = allProducts.map((product) => ({
    id: product.id,
    name: product.name,
    size: sizeLabel(product.size),
    priceCents: product.priceCents ?? null,
    orderable: canOrderOnline(product),
  }));

  return (
    <CheckoutForm
      products={products}
      options={{
        pickup: settings.pickup_enabled,
        delivery: settings.delivery_enabled,
        shipping: settings.shipping_enabled,
      }}
      deliveryMinOrderCents={settings.delivery_min_order_cents}
      deliveryStandardHours={settings.delivery_standard_hours}
      rushFeeCents={settings.rush_fee_cents}
      shippingStates={settings.shipping_states}
    />
  );
}

function ClosedCheckout() {
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
