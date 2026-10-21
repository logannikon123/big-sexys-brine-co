import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

/**
 * When an order is paid, tell Jesse and the customer:
 *
 * - a phone alert through Pushover (PUSHOVER_TOKEN, PUSHOVER_USER),
 * - an email to ORDER_ALERT_EMAIL with the order details,
 * - a receipt email to the customer with a link to their order page.
 *
 * Each order is announced once: the first caller sets alerted_at, and any
 * later caller (a second webhook message, say) finds it set and stops. A
 * missing setting or a failed send is logged, never thrown, because the
 * customer has already paid and their order must not fail over an email.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");
const FROM = "Big Sexy's Brine Co. <noreply@bigsexysbrine.co>";

const HOW_THEY_GET_IT: Record<string, string> = {
  pickup: "Pickup",
  local_delivery: "Local delivery",
  shipping: "Shipping",
};

interface PaidOrder {
  id: string;
  order_number: number;
  public_token: string;
  fulfillment_type: string;
  delivery_date: string | null;
  is_rush: boolean;
  pickup_instructions: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_notes: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  subtotal_cents: number;
  delivery_fee_cents: number;
  rush_fee_cents: number;
  packing_fee_cents: number;
  shipping_postage_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  square_environment: string | null;
  order_items: { product_name: string; product_size: string | null; quantity: number; line_total_cents: number }[];
}

/** "2026-10-27" as "Tuesday, October 27". */
function longDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function addressLines(order: PaidOrder): string[] {
  if (!order.address_line1) return [];
  return [
    order.address_line1,
    ...(order.address_line2 ? [order.address_line2] : []),
    `${order.city ?? ""}, ${order.state ?? ""} ${order.postal_code ?? ""}`.trim(),
  ];
}

function itemLines(order: PaidOrder): string[] {
  return order.order_items.map(
    (item) =>
      `${item.quantity} x ${item.product_name}${item.product_size ? `, ${item.product_size}` : ""}: ${formatPrice(item.line_total_cents)}`
  );
}

function moneyLines(order: PaidOrder): string[] {
  const lines = [`Subtotal: ${formatPrice(order.subtotal_cents)}`];
  if (order.delivery_fee_cents > 0) lines.push(`Delivery: ${formatPrice(order.delivery_fee_cents)}`);
  if (order.rush_fee_cents > 0) lines.push(`Rush fee: ${formatPrice(order.rush_fee_cents)}`);
  if (order.packing_fee_cents > 0) lines.push(`Packing: ${formatPrice(order.packing_fee_cents)}`);
  if (order.shipping_postage_cents > 0) lines.push(`Postage: ${formatPrice(order.shipping_postage_cents)}`);
  if (order.discount_cents > 0) lines.push(`Discount: -${formatPrice(order.discount_cents)}`);
  lines.push(`Local sales tax: ${formatPrice(order.tax_cents)}`);
  lines.push(`Total: ${formatPrice(order.total_cents)}`);
  return lines;
}

function howLine(order: PaidOrder): string {
  const how = HOW_THEY_GET_IT[order.fulfillment_type] ?? order.fulfillment_type;
  if (order.fulfillment_type === "local_delivery" && order.delivery_date) {
    return `${how} on ${longDate(order.delivery_date)}${order.is_rush ? " (rush)" : ""}`;
  }
  return how;
}

/** Marks the order announced and returns it, or null if it was already announced. */
async function claimOrder(orderId: string): Promise<PaidOrder | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ alerted_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("alerted_at", null)
    .select(
      "id, order_number, public_token, fulfillment_type, delivery_date, is_rush, pickup_instructions, customer_name, customer_email, customer_phone, customer_notes, address_line1, address_line2, city, state, postal_code, subtotal_cents, delivery_fee_cents, rush_fee_cents, packing_fee_cents, shipping_postage_cents, discount_cents, tax_cents, total_cents, square_environment, order_items(product_name, product_size, quantity, line_total_cents)"
    )
    .maybeSingle();
  if (error) {
    console.error("Order alert: couldn't read the order:", error.message);
    return null;
  }
  return (data as PaidOrder | null) ?? null;
}

async function sendPushover(order: PaidOrder, test: boolean) {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  if (!token || !user) {
    console.error("Order alert: PUSHOVER_TOKEN or PUSHOVER_USER is not set, so no phone alert.");
    return;
  }
  const jars = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      user,
      title: `${test ? "TEST " : ""}New order #${order.order_number}: ${formatPrice(order.total_cents)}`,
      message: `${howLine(order)}. ${jars} ${jars === 1 ? "jar" : "jars"} for ${order.customer_name}.`,
      url: `${SITE_URL}/admin/orders/${order.id}`,
      url_title: "Open in Admin",
    }),
  });
  if (!res.ok) console.error("Order alert: Pushover refused the alert:", res.status);
}

async function sendEmails(order: PaidOrder, test: boolean) {
  if (!process.env.RESEND_API_KEY) {
    console.error("Order alert: RESEND_API_KEY is not set, so no order emails.");
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const tag = test ? "[TEST] " : "";
  const orderPage = `${SITE_URL}/order/${order.public_token}`;

  const alertTo = process.env.ORDER_ALERT_EMAIL;
  if (alertTo) {
    const result = await resend.emails.send({
      from: FROM,
      to: alertTo,
      replyTo: order.customer_email,
      subject: `${tag}New order #${order.order_number}: ${formatPrice(order.total_cents)} (${HOW_THEY_GET_IT[order.fulfillment_type] ?? order.fulfillment_type})`,
      text: [
        `Order #${order.order_number} is paid.`,
        "",
        howLine(order),
        ...addressLines(order),
        "",
        `Customer: ${order.customer_name}`,
        `Email: ${order.customer_email}`,
        ...(order.customer_phone ? [`Phone: ${order.customer_phone}`] : []),
        ...(order.customer_notes ? ["", `Notes: ${order.customer_notes}`] : []),
        "",
        ...itemLines(order),
        "",
        ...moneyLines(order),
        "",
        `Open in Admin: ${SITE_URL}/admin/orders/${order.id}`,
      ].join("\n"),
    });
    if (result.error) console.error("Order alert: Resend refused the alert email:", result.error.message);
  } else {
    console.error("Order alert: ORDER_ALERT_EMAIL is not set, so no alert email.");
  }

  const how =
    order.fulfillment_type === "pickup"
      ? ["How to get your jars: pickup.", ...(order.pickup_instructions ? [order.pickup_instructions] : [])]
      : [`How to get your jars: ${howLine(order).toLowerCase()}, to:`, ...addressLines(order)];

  const receipt = await resend.emails.send({
    from: FROM,
    to: order.customer_email,
    ...(alertTo ? { replyTo: alertTo } : {}),
    subject: `${tag}Your Big Sexy's Brine Co. order #${order.order_number}`,
    text: [
      `Hi ${order.customer_name},`,
      "",
      `Thanks for your order! We got your payment of ${formatPrice(order.total_cents)}.`,
      "",
      ...how,
      "",
      ...itemLines(order),
      "",
      ...moneyLines(order),
      "",
      `See your order any time: ${orderPage}`,
      "",
      "Questions? Reply to this email.",
      "",
      "Big Sexy's Brine Co.",
    ].join("\n"),
  });
  if (receipt.error) console.error("Order alert: Resend refused the receipt email:", receipt.error.message);
}

/** Announce a paid order once. Never throws. */
export async function notifyOrderPaid(orderId: string): Promise<void> {
  try {
    const order = await claimOrder(orderId);
    if (!order) return;
    const test = order.square_environment !== "production";
    const results = await Promise.allSettled([sendPushover(order, test), sendEmails(order, test)]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          "Order alert failed:",
          result.reason instanceof Error ? result.reason.message : "unknown error"
        );
      }
    }
  } catch (error) {
    console.error("Order alert failed:", error instanceof Error ? error.message : "unknown error");
  }
}
