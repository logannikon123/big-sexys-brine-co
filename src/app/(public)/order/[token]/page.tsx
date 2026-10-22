import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import {
  OrderFulfillmentCard,
  OrderStatusCard,
  OrderSummaryCard,
} from "@/components/order/OrderDetails";
import { getPublicOrder } from "@/lib/orders/public-order";

export const metadata: Metadata = {
  title: "Your Order",
  robots: { index: false, follow: false },
  // The link is the key to the order, so don't pass it on to other sites.
  referrer: "no-referrer",
};

// Customer details: build the page fresh for every visit and never cache it.
export const dynamic = "force-dynamic";

/**
 * The customer's private order page. The long random code in the link is
 * the only way in, so anyone with the link can see the order.
 */
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getPublicOrder(token);
  if (!order) notFound();

  return (
    <section className="pt-28 pb-24">
      <Container className="max-w-3xl">
        <h1 className="mb-8 font-display text-4xl font-bold text-brand-cream sm:text-5xl">
          {`Order #${order.order_number}`}
        </h1>
        <div className="space-y-6">
          <OrderStatusCard order={order} />
          <OrderFulfillmentCard order={order} />
          <OrderSummaryCard order={order} />
          <p className="text-sm text-brand-cream/60">
            Questions? Reach us on the{" "}
            <Link href="/contact" className="underline hover:text-brand-orange">
              contact page
            </Link>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
