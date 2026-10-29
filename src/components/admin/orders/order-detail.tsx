import Link from "next/link";
import { ChevronLeft, ExternalLink, GraduationCap, Mail, MapPin, Phone } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  Order,
  OrderEmail,
  OrderEmailKind,
  OrderItem,
  OrderRefund,
  OrderTaxPart,
} from "@/types/orders";
import { splitTaxCents, type RefundFor } from "@/lib/tax-split";
import { classWhen } from "@/lib/classes/format";
import { FULL_REFUND_DAYS } from "@/types/classes";
import type { OrderClassBooking } from "@/app/admin/classes/class-data";
import {
  OPEN_STATUSES,
  formatDeliveryDate,
  formatOrderTime,
  fulfillmentLabel,
} from "./order-flow";
import {
  OrderMoneyBadges,
  OrderStatusBadge,
  RushBadge,
  SandboxBadge,
} from "./order-badges";
import { OrderStatusButtons } from "./order-status-buttons";
import { OrderTrackingForm } from "./order-tracking-form";
import { OrderNoteForm } from "./order-note-form";
import { RefundForBox } from "./refund-for-form";

interface OrderDetailProps {
  order: Order;
  items: OrderItem[];
  refunds: OrderRefund[];
  emails: OrderEmail[];
  taxParts: OrderTaxPart[];
  demo: boolean;
  /** The booking behind a class order. Null for jar orders, or if it didn't load. */
  classBooking?: OrderClassBooking | null;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">{children}</CardContent>
    </Card>
  );
}

/** A label on the left and a value on the right. */
function Row({
  label,
  children,
  strong = false,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex justify-between gap-4 border-t border-border pt-2 font-bold"
          : "flex justify-between gap-4"
      }
    >
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** 750 becomes "7.5%". */
function formatRate(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** "VISA" becomes "Visa", "AMERICAN_EXPRESS" becomes "American Express". */
function formatCardBrand(brand: string): string {
  return brand
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function jars(count: number): string {
  return count === 1 ? "1 jar" : `${count} jars`;
}

function seats(count: number): string {
  return count === 1 ? "1 seat" : `${count} seats`;
}

function addressLines(order: Order): string[] {
  const cityLine = [
    order.city,
    [order.state, order.postal_code].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return [order.address_line1, order.address_line2, cityLine].filter(
    (line): line is string => Boolean(line)
  );
}

function HowTheyGetIt({ order }: { order: Order }) {
  const address = addressLines(order);
  const miles =
    order.delivery_miles === null ? null : Number(order.delivery_miles);
  const mapsUrl =
    address.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.join(", "))}`
      : null;

  return (
    <Section title="How they get it">
      <dl className="space-y-2 text-sm">
        <Row label="Type">
          <span className="inline-flex items-center gap-2">
            {fulfillmentLabel(order.fulfillment_type)}
            {order.is_rush && <RushBadge />}
          </span>
        </Row>
        {order.delivery_date && (
          <Row
            label={
              order.fulfillment_type === "pickup" ? "Pickup day" : "Delivery day"
            }
          >
            {formatDeliveryDate(order.delivery_date)}
          </Row>
        )}
        {order.is_rush && (
          <Row label="Rush">Yes, the customer paid for rush</Row>
        )}
        {miles !== null && Number.isFinite(miles) && (
          <Row label="Distance">{miles.toFixed(1)} miles</Row>
        )}
      </dl>

      {order.fulfillment_type === "pickup" && order.pickup_instructions && (
        <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
          <p className="mb-1 font-medium">Pickup instructions they saw</p>
          <p className="whitespace-pre-line text-muted-foreground">
            {order.pickup_instructions}
          </p>
        </div>
      )}

      {address.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="mb-1 font-medium">Address</p>
          {address.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {mapsUrl && order.fulfillment_type === "local_delivery" && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex h-11 items-center gap-2 text-brand-orange underline underline-offset-4"
            >
              <MapPin className="h-4 w-4" />
              Open in Google Maps
            </a>
          )}
        </div>
      )}
    </Section>
  );
}

/** For a class order: which class, where, and how many seats. */
function ClassBookingSection({
  booking,
}: {
  booking: OrderClassBooking | null | undefined;
}) {
  const session = booking?.session;
  return (
    <Section title="Class booking">
      {!booking || !session ? (
        <p className="text-sm text-muted-foreground">
          The class date for this order didn&apos;t load. See it on Class sessions.
        </p>
      ) : (
        <dl className="space-y-2 text-sm">
          <Row label="When">{classWhen(session.starts_at, session.ends_at)}</Row>
          <Row label="Where">
            {session.location_name}
            {session.location_address && (
              <span className="block text-muted-foreground">{session.location_address}</span>
            )}
          </Row>
          <Row label="Seats">{seats(booking.seats)}</Row>
          {booking.cancelled_at && (
            <Row label="Booking">Cancelled {formatOrderTime(booking.cancelled_at)}</Row>
          )}
        </dl>
      )}
      {booking?.cancel_note && (
        <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
          <p className="mb-1 font-medium">Why it was cancelled</p>
          <p className="whitespace-pre-line text-muted-foreground">{booking.cancel_note}</p>
        </div>
      )}
      <Link
        href="/admin/classes"
        className="mt-3 inline-flex h-11 items-center gap-2 text-sm text-brand-orange underline underline-offset-4"
      >
        <GraduationCap className="h-4 w-4" />
        See this class on Class sessions
      </Link>
    </Section>
  );
}

function Items({ items, isClass }: { items: OrderItem[]; isClass: boolean }) {
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return (
    <Section title={isClass ? `What they booked (${seats(count)})` : `What to pack (${jars(count)})`}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items on this order.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="mr-2 inline-flex min-w-8 justify-center rounded bg-brand-orange/15 px-1.5 text-brand-orange">
                    {item.quantity}x
                  </span>
                  {item.product_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.product_size ? `${item.product_size}, ` : ""}
                  {formatPrice(item.unit_price_cents)} each
                </p>
              </div>
              <p className="shrink-0 font-medium">
                {formatPrice(item.line_total_cents)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Customer({ order }: { order: Order }) {
  return (
    <Section title="Customer">
      <p className="font-medium">{order.customer_name}</p>
      <div className="mt-2 flex flex-col">
        <a
          href={`mailto:${order.customer_email}`}
          className="inline-flex h-11 items-center gap-2 break-all text-brand-orange underline underline-offset-4"
        >
          <Mail className="h-4 w-4 shrink-0" />
          {order.customer_email}
        </a>
        {order.customer_phone && (
          <a
            href={`tel:${order.customer_phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex h-11 items-center gap-2 text-brand-orange underline underline-offset-4"
          >
            <Phone className="h-4 w-4 shrink-0" />
            {order.customer_phone}
          </a>
        )}
      </div>
      {order.customer_notes && (
        <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm">
          <p className="mb-1 font-medium">Note from the customer</p>
          <p className="whitespace-pre-line">{order.customer_notes}</p>
        </div>
      )}
    </Section>
  );
}

/** Square's refund states, in plain words. Completed refunds show no word. */
function refundStateNote(status: string): string | null {
  switch (status) {
    case "COMPLETED":
      return null;
    case "PENDING":
      return "Waiting on Square";
    default:
      return "Didn't go through";
  }
}

const REFUND_FOR_LABEL: Record<RefundFor, string> = {
  fees: "Fees only",
  jars: "Jars only",
  both: "Some of each",
  unsure: "Not sure",
};

/**
 * The saved split of one refund in words, with the tax shared between the
 * order's city and county as the tax report shares it.
 */
function RefundSplitText({
  refund,
  taxParts,
}: {
  refund: OrderRefund;
  taxParts: OrderTaxPart[];
}) {
  if (refund.jars_cents === null || refund.fees_cents === null || refund.tax_cents === null) {
    return (
      <p className="text-muted-foreground">
        {refund.refund_for === "unsure"
          ? "Not sure. The tax report lists this refund for you to check."
          : "Not answered yet."}
      </p>
    );
  }
  const shares =
    refund.tax_cents > 0 && taxParts.length > 0
      ? splitTaxCents(
          refund.jars_cents,
          taxParts.map((p) => ({ rateBps: p.rate_bps })),
          refund.tax_cents
        )
      : [];
  const places = taxParts
    .map((p, i) => ({ name: p.name, cents: shares[i] ?? 0 }))
    .filter((p) => p.cents > 0);
  return (
    <>
      <p>
        {refund.refund_for ? `${REFUND_FOR_LABEL[refund.refund_for]}: ` : "Whole order: "}
        jars {formatPrice(refund.jars_cents)}, tax {formatPrice(refund.tax_cents)}, fees{" "}
        {formatPrice(refund.fees_cents)}
      </p>
      {places.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tax back: {places.map((p) => `${p.name} ${formatPrice(p.cents)}`).join(", ")}
        </p>
      )}
    </>
  );
}

/**
 * For the tax report: what each refund was for. A refund of the whole order
 * splits by itself. For a part refund, Jesse picks.
 */
function RefundSplits({
  order,
  refunds,
  taxParts,
  demo,
}: {
  order: Order;
  refunds: OrderRefund[];
  taxParts: OrderTaxPart[];
  demo: boolean;
}) {
  const live = refunds.filter((r) => r.status === "COMPLETED" || r.status === "PENDING");
  if (live.length === 0) return null;
  // An order that paid no tax gets none back.
  const rateBps = order.tax_cents > 0 ? (order.tax_rate_bps ?? 0) : 0;

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div>
        <p className="font-medium">What each refund was for</p>
        <p className="text-xs text-muted-foreground">
          Square refunds an amount, not items. Your answer tells the tax report
          how much tax went back to each city and county.
        </p>
      </div>
      {live.map((refund) => {
        const automatic = refund.refund_for === null && refund.jars_cents !== null;
        return (
          <div key={refund.id} className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">
              {formatPrice(refund.amount_cents)} refund
              {refund.source === "backfill" ? "" : `, ${formatOrderTime(refund.refunded_at)}`}
            </p>
            {automatic ? (
              <div className="text-sm">
                <RefundSplitText refund={refund} taxParts={taxParts} />
              </div>
            ) : (
              <RefundForBox
                refundId={refund.id}
                amountCents={refund.amount_cents}
                rateBps={rateBps}
                refundFor={refund.refund_for}
                jarsCents={refund.jars_cents}
                demo={demo}
                summary={<RefundSplitText refund={refund} taxParts={taxParts} />}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Money({
  order,
  refunds,
  taxParts,
  demo,
}: {
  order: Order;
  refunds: OrderRefund[];
  taxParts: OrderTaxPart[];
  demo: boolean;
}) {
  const kept = order.total_cents - order.refunded_cents;
  return (
    <Section title="Money">
      <dl className="space-y-2 text-sm">
        <Row label={order.fulfillment_type === "class" ? "Class" : "Jars"}>
          {formatPrice(order.subtotal_cents)}
        </Row>
        {order.delivery_fee_cents > 0 && (
          <Row label="Delivery fee">{formatPrice(order.delivery_fee_cents)}</Row>
        )}
        {order.rush_fee_cents > 0 && (
          <Row label="Rush fee">{formatPrice(order.rush_fee_cents)}</Row>
        )}
        {order.packing_fee_cents > 0 && (
          <Row label="Packing fee">{formatPrice(order.packing_fee_cents)}</Row>
        )}
        {order.shipping_postage_cents > 0 && (
          <Row label="Postage">{formatPrice(order.shipping_postage_cents)}</Row>
        )}
        {order.discount_cents > 0 && (
          <Row label="Discount">-{formatPrice(order.discount_cents)}</Row>
        )}
        <Row
          label={
            <>
              Sales tax
              {(order.tax_jurisdiction || order.tax_rate_bps !== null) && (
                <span>
                  {" "}
                  (
                  {[
                    order.tax_jurisdiction,
                    order.tax_rate_bps !== null
                      ? formatRate(order.tax_rate_bps)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  )
                </span>
              )}
              {/* Checkout saves no rate when it had none on file for the
                  address, and charges 0% (see src/lib/checkout/quote.ts). */}
              {order.tax_rate_bps === null && (
                <span className="block text-xs">
                  No local rate on file: charged 0%
                </span>
              )}
            </>
          }
        >
          {formatPrice(order.tax_cents)}
        </Row>
        <Row label="Total paid" strong>
          {formatPrice(order.total_cents)}
        </Row>
        {refunds.map((refund) => {
          const note = refundStateNote(refund.status);
          return (
            <Row
              key={refund.id}
              label={
                <>
                  Refund{" "}
                  {refund.source === "backfill"
                    ? "(made before refunds were listed one by one)"
                    : formatOrderTime(refund.refunded_at)}
                  {note && <span className="block text-xs">{note}</span>}
                  {refund.reason && (
                    <span className="block text-xs">{refund.reason}</span>
                  )}
                </>
              }
            >
              <span className={note ? "line-through" : undefined}>
                -{formatPrice(refund.amount_cents)}
              </span>
            </Row>
          );
        })}
        {order.refunded_cents > 0 && (
          <>
            <Row label="Refunded in Square, in all">
              -{formatPrice(order.refunded_cents)}
            </Row>
            <Row label="You keep" strong>
              {formatPrice(kept)}
            </Row>
          </>
        )}
      </dl>
      <RefundSplits order={order} refunds={refunds} taxParts={taxParts} demo={demo} />
    </Section>
  );
}

function Payment({ order }: { order: Order }) {
  return (
    <Section title="Payment">
      <dl className="space-y-2 text-sm">
        {order.square_environment === "sandbox" && (
          <Row label="Kind">
            <SandboxBadge />
          </Row>
        )}
        {order.card_brand && order.card_last4 && (
          <Row label="Card">
            {formatCardBrand(order.card_brand)} ending {order.card_last4}
          </Row>
        )}
        {order.paid_at && (
          <Row label="Paid">{formatOrderTime(order.paid_at)}</Row>
        )}
        {order.payment_error_code && (
          <Row label="Square said">{order.payment_error_code}</Row>
        )}
        <Row label="Store terms">
          {order.terms_accepted_at
            ? `Agreed ${formatOrderTime(order.terms_accepted_at)}${order.terms_version ? ` (version ${order.terms_version})` : ""}`
            : "No record"}
        </Row>
      </dl>
      {order.square_receipt_url && (
        <a
          href={order.square_receipt_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-11 items-center gap-2 text-sm text-brand-orange underline underline-offset-4"
        >
          <ExternalLink className="h-4 w-4" />
          Square receipt
        </a>
      )}
    </Section>
  );
}

const EMAIL_LABEL: Record<OrderEmailKind, string> = {
  ready_for_pickup: "Ready for pickup email",
  out_for_delivery: "Out for delivery email",
  shipped: "Shipped email",
  delivered: "Delivered email",
  cancelled: "Cancelled email",
  refunded: "Refund email",
};

/** The emails sent to the customer after the receipt, oldest first. */
function Emails({ emails }: { emails: OrderEmail[] }) {
  if (emails.length === 0) return null;
  return (
    <div className="space-y-1 border-t border-border pt-3 text-xs">
      <p className="font-medium">Emails to the customer</p>
      <dl className="space-y-1">
        {emails.map((email) => (
          <div key={email.id} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{EMAIL_LABEL[email.kind]}</dt>
            <dd className="text-right">
              {email.sent_at ? (
                `Sent ${formatOrderTime(email.sent_at)}`
              ) : email.error ? (
                <span className="text-red-300">Didn&apos;t send</span>
              ) : (
                "Sending"
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A box at the top of Next step when a refund or dispute needs a word. */
function MoneyWarning({ order }: { order: Order }) {
  const open = (OPEN_STATUSES as readonly string[]).includes(order.status);
  let tone = "border-amber-500/40 bg-amber-500/10";
  let text: string | null = null;

  if (order.dispute_status === "open") {
    tone = "border-red-500/40 bg-red-500/10";
    text =
      "The customer's bank is questioning this payment. Answer it under Disputes in your Square Dashboard. You can still finish the order here.";
  } else if (order.dispute_status === "lost") {
    tone = "border-red-500/40 bg-red-500/10";
    text = "The bank sided with the customer and took the payment back.";
  } else if (order.dispute_status === "won") {
    tone = "border-emerald-500/40 bg-emerald-500/10";
    text = "The bank sided with you on the card dispute. You keep the payment.";
  } else if (order.refund_status === "full" && open) {
    text =
      order.fulfillment_type === "class"
        ? "This booking was refunded in full in Square, so its seats are free again. To mark it cancelled, use Class sessions."
        : "This order was refunded in full in Square. If you aren't sending the jars, cancel it.";
  }

  if (!text) return null;
  return (
    <div role="status" className={`rounded-md border p-3 text-sm ${tone}`}>
      {text}
    </div>
  );
}

/** The steps done so far, oldest first. */
function History({ order }: { order: Order }) {
  const steps: [string, string | null][] = [
    ["Placed", order.created_at],
    ["Paid", order.paid_at],
    ["Ready for pickup", order.ready_at],
    ["Out for delivery", order.out_for_delivery_at],
    ["Shipped", order.shipped_at],
    [
      order.fulfillment_type === "class"
        ? "Attended"
        : order.fulfillment_type === "pickup"
          ? "Picked up"
          : "Delivered",
      order.fulfilled_at,
    ],
    ["Cancelled", order.cancelled_at],
    ["Card dispute opened", order.disputed_at],
    ["Card dispute closed", order.dispute_closed_at],
  ];
  const done = steps.filter(
    (step): step is [string, string] => step[1] !== null
  );
  return (
    <dl className="space-y-1 border-t border-border pt-3 text-xs">
      {done.map(([label, at]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right">{formatOrderTime(at)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OrderDetail({
  order,
  items,
  refunds,
  emails,
  taxParts,
  demo,
  classBooking,
}: OrderDetailProps) {
  const isShipping = order.fulfillment_type === "shipping";
  const isClass = order.fulfillment_type === "class";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/orders"
          className="inline-flex h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All orders
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold">
            Order #{order.order_number}
          </h1>
          <OrderStatusBadge status={order.status} type={order.fulfillment_type} className="text-sm" />
          <OrderMoneyBadges
            refundStatus={order.refund_status}
            disputeStatus={order.dispute_status}
            className="text-sm"
          />
          {order.is_rush && <RushBadge />}
          {order.square_environment === "sandbox" && <SandboxBadge />}
        </div>
        <p className="text-sm text-muted-foreground">
          Placed {formatOrderTime(order.created_at)} by {order.customer_name}
        </p>
      </div>

      {/*
        Phones show one column: next step first, then the order, then notes.
        Wide screens put the next step and notes in a column on the right.
      */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-start-3 lg:row-start-1">
          <Section title="Next step">
            <div className="space-y-4">
              <MoneyWarning order={order} />
              <OrderStatusButtons
                orderId={order.id}
                orderNumber={order.order_number}
                status={order.status}
                fulfillmentType={order.fulfillment_type}
                hasTracking={Boolean(order.tracking_number?.trim())}
                demo={demo}
              />
              {isClass && (
                <div className="space-y-1 text-sm">
                  <Link
                    href="/admin/classes"
                    className="inline-flex h-11 items-center gap-2 text-brand-orange underline underline-offset-4"
                  >
                    <GraduationCap className="h-4 w-4" />
                    Cancel or refund from Class sessions
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Class bookings are cancelled there, so the {FULL_REFUND_DAYS}-day
                    refund rule is applied and the seats are freed.
                  </p>
                </div>
              )}
              <History order={order} />
              <Emails emails={emails} />
            </div>
          </Section>
          {isShipping && (
            <Section title="Tracking">
              <OrderTrackingForm
                orderId={order.id}
                trackingNumber={order.tracking_number}
                trackingCarrier={order.tracking_carrier}
                demo={demo}
              />
            </Section>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {isClass ? (
            <ClassBookingSection booking={classBooking} />
          ) : (
            <HowTheyGetIt order={order} />
          )}
          <Items items={items} isClass={isClass} />
          <Customer order={order} />
          <Money order={order} refunds={refunds} taxParts={taxParts} demo={demo} />
          <Payment order={order} />
        </div>

        <div className="space-y-6 lg:col-start-3 lg:row-start-2">
          <Section title="Your notes">
            <OrderNoteForm
              orderId={order.id}
              note={order.admin_notes}
              demo={demo}
            />
          </Section>
          {!isClass && (
            <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm">
              <p className="font-medium">Waiving a fee or giving a discount</p>
              <p className="mt-1 text-muted-foreground">
                To waive a fee or give a discount, refund that amount in your
                Square Dashboard. The order updates here automatically, keeps
                its next step, and the customer gets a refund email.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
