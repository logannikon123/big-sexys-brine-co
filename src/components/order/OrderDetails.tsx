import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicOrder } from "@/lib/orders/public-order";
import type { OrderStatus } from "@/types/orders";
import { formatPrice } from "@/lib/utils";

/** "2026-10-27" -> "Tuesday, October 27" */
function longDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** When the order was placed, in Colorado time: "October 20, 2026" */
function placedDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  }).format(new Date(timestamp));
}

const cardClass = "space-y-3 rounded-xl border border-brand-brown/20 bg-card p-5 sm:p-6";
const headingClass = "font-display text-xl font-semibold text-brand-cream";
const linkClass = "underline hover:text-brand-orange";

const STATUS_TEXT: Record<OrderStatus, string> = {
  pending_payment: "We're confirming your payment.",
  payment_failed: "Your payment didn't go through.",
  paid: "Paid. We're getting your jars ready.",
  ready_for_pickup: "Your jars are ready to pick up.",
  out_for_delivery: "Your jars are on the way today.",
  shipped: "Your jars are in the mail.",
  fulfilled: "All done. Enjoy your pickles!",
  cancelled: "We cancelled this order.",
  refunded: "We refunded this order.",
  partially_refunded: "Paid. We refunded part of this order.",
  disputed: "Your card company has questioned this payment. We're looking into it.",
};

export function OrderStatusCard({ order }: { order: PublicOrder }) {
  return (
    <div className={cardClass}>
      <p className="text-lg font-semibold text-brand-cream">{STATUS_TEXT[order.status]}</p>
      {order.status === "payment_failed" && (
        <p className="text-brand-cream/80">
          <Link href="/cart" className={linkClass}>
            Go back to your cart
          </Link>{" "}
          to try again.
        </p>
      )}
      {order.status === "shipped" && order.tracking_number && (
        <p className="break-words text-brand-cream/80">
          Tracking number{order.tracking_carrier ? ` (${order.tracking_carrier})` : ""}:{" "}
          <span className="font-semibold text-brand-cream">{order.tracking_number}</span>
        </p>
      )}
      <p className="text-sm text-brand-cream/60">Placed {placedDate(order.created_at)}</p>
    </div>
  );
}

function Address({ order }: { order: PublicOrder }) {
  const cityLine = [order.city, [order.state, order.postal_code].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const lines = [order.address_line1, order.address_line2, cityLine].filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <address className="break-words not-italic text-brand-cream/80">
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </address>
  );
}

export function OrderFulfillmentCard({ order }: { order: PublicOrder }) {
  let title: string;
  let body: ReactNode;

  if (order.fulfillment_type === "pickup") {
    title = "Pickup";
    body = order.pickup_instructions ? (
      <p className="whitespace-pre-line break-words text-brand-cream/80">
        {order.pickup_instructions}
      </p>
    ) : (
      <p className="text-brand-cream/80">We&apos;ll tell you where and when to pick up.</p>
    );
  } else if (order.fulfillment_type === "local_delivery") {
    title = "Local delivery";
    body = (
      <>
        {order.delivery_date && (
          <p className="font-semibold text-brand-cream">
            {longDate(order.delivery_date)}
            {order.is_rush ? " (rush)" : ""}
          </p>
        )}
        <Address order={order} />
      </>
    );
  } else {
    title = "Shipping";
    body = <Address order={order} />;
  }

  return (
    <div className={cardClass}>
      <h2 className={headingClass}>{title}</h2>
      {body}
      <p className="break-words text-sm text-brand-cream/60">
        For {order.customer_name} ({order.customer_email})
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-brand-cream/80">
      <span className="min-w-0 break-words">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

export function OrderSummaryCard({ order }: { order: PublicOrder }) {
  const fees: { label: string; cents: number }[] = [
    { label: "Delivery", cents: order.delivery_fee_cents },
    { label: "Rush fee", cents: order.rush_fee_cents },
    { label: "Packing", cents: order.packing_fee_cents },
    { label: "Postage", cents: order.shipping_postage_cents },
    { label: "Discount", cents: -order.discount_cents },
  ].filter((fee) => fee.cents !== 0);

  let taxLabel = "Local sales tax";
  if (order.tax_cents > 0 && order.tax_jurisdiction) taxLabel += ` (${order.tax_jurisdiction})`;

  // Square sends brands like "VISA" or "AMERICAN_EXPRESS".
  const cardBrand = order.card_brand?.replace(/_/g, " ");
  const receiptUrl = order.square_receipt_url?.startsWith("https://")
    ? order.square_receipt_url
    : null;

  return (
    <div className={cardClass}>
      <h2 className={headingClass}>Your order</h2>
      <ul className="space-y-2 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 text-brand-cream/80">
            <span className="min-w-0 break-words">
              {item.quantity} × {item.product_name}
              {item.product_size ? `, ${item.product_size}` : ""}
            </span>
            <span className="shrink-0 tabular-nums">{formatPrice(item.line_total_cents)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-brand-brown/30 pt-4 text-sm">
        <Row label="Subtotal" value={formatPrice(order.subtotal_cents)} />
        {fees.map((fee) => (
          <Row key={fee.label} label={fee.label} value={formatPrice(fee.cents)} />
        ))}
        <Row label={taxLabel} value={formatPrice(order.tax_cents)} />
        <div className="flex items-baseline justify-between gap-4 border-t border-brand-brown/30 pt-3">
          <span className="font-semibold text-brand-cream">Total</span>
          <span className="font-display text-2xl font-bold text-brand-gold tabular-nums">
            {formatPrice(order.total_cents)}
          </span>
        </div>
        {order.refunded_cents > 0 && (
          <Row label="Refunded" value={formatPrice(-order.refunded_cents)} />
        )}
      </div>

      {(cardBrand || order.card_last4 || receiptUrl) && (
        <div className="space-y-1 border-t border-brand-brown/30 pt-4 text-sm text-brand-cream/80">
          {(cardBrand || order.card_last4) && (
            <p>
              {cardBrand ? `Card: ${cardBrand}` : "Card"}
              {order.card_last4 ? ` ending in ${order.card_last4}` : ""}
            </p>
          )}
          {receiptUrl && (
            <p>
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                See your Square receipt
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
