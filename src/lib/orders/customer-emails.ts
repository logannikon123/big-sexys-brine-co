/**
 * The words of the emails a customer gets after the receipt: ready for
 * pickup, out for delivery, shipped, delivered, cancelled and refunded.
 * This file only builds the text. src/lib/orders/notify.ts sends it and
 * logs each one in order_emails, so it goes out once.
 *
 * Plain text, in the same style as the receipt.
 */

import { formatPrice } from "@/lib/utils";
import { trackingUrl } from "@/components/admin/orders/order-flow";
import type { FulfillmentType, Order, OrderEmailKind, OrderStatus } from "@/types/orders";

/**
 * Which emails go out. The out-for-delivery and delivered emails are extras:
 * switch one off here and that step sends nothing.
 */
export const CUSTOMER_EMAILS_ON: Record<OrderEmailKind, boolean> = {
  ready_for_pickup: true,
  out_for_delivery: true,
  shipped: true,
  delivered: true,
  cancelled: true,
  refunded: true,
};

/**
 * The email for a step Jesse takes, or null when that step sends none. A
 * picked-up order sends nothing: the customer was there.
 */
export function emailKindForStep(step: OrderStatus, type: FulfillmentType): OrderEmailKind | null {
  let kind: OrderEmailKind | null = null;
  switch (step) {
    case "ready_for_pickup":
      kind = "ready_for_pickup";
      break;
    case "out_for_delivery":
      kind = "out_for_delivery";
      break;
    case "shipped":
      kind = "shipped";
      break;
    case "fulfilled":
      // Nothing to say after pickup or a class: the customer was there.
      kind = type === "pickup" || type === "class" ? null : "delivered";
      break;
    case "cancelled":
      kind = "cancelled";
      break;
  }
  return kind && CUSTOMER_EMAILS_ON[kind] ? kind : null;
}

/** The order fields the emails use. */
export type EmailOrder = Pick<
  Order,
  | "order_number"
  | "public_token"
  | "fulfillment_type"
  | "customer_name"
  | "address_line1"
  | "address_line2"
  | "city"
  | "state"
  | "postal_code"
  | "tracking_number"
  | "tracking_carrier"
  | "total_cents"
  | "refunded_cents"
  | "square_environment"
> & {
  order_items: { product_name: string; product_size: string | null; quantity: number }[];
};

export interface EmailOptions {
  siteUrl: string;
  /** Pickup instructions from the store settings, for the ready email. */
  pickupInstructions?: string | null;
}

export interface BuiltEmail {
  subject: string;
  text: string;
}

function isTest(order: EmailOrder): boolean {
  return order.square_environment !== "production";
}

function addressLines(order: EmailOrder): string[] {
  if (!order.address_line1) return [];
  return [
    order.address_line1,
    ...(order.address_line2 ? [order.address_line2] : []),
    `${order.city ?? ""}, ${order.state ?? ""} ${order.postal_code ?? ""}`.trim(),
  ];
}

function itemLines(order: EmailOrder): string[] {
  return order.order_items.map(
    (item) =>
      `${item.quantity} x ${item.product_name}${item.product_size ? `, ${item.product_size}` : ""}`
  );
}

/** Greeting, the body, then the same sign-off as the receipt. */
function letter(order: EmailOrder, options: EmailOptions, subject: string, body: string[]): BuiltEmail {
  const orderPage = `${options.siteUrl}/order/${order.public_token}`;
  return {
    subject: `${isTest(order) ? "[TEST] " : ""}${subject}`,
    text: [
      `Hi ${order.customer_name},`,
      "",
      ...body,
      "",
      `See your order any time: ${orderPage}`,
      "",
      "Questions? Reply to this email.",
      "",
      "Big Sexy's Brine Co.",
    ].join("\n"),
  };
}

const BANK_NOTE = "Your bank may take a few business days to show it.";

/** The email for a step Jesse took. */
export function buildStepEmail(
  kind: Exclude<OrderEmailKind, "refunded">,
  order: EmailOrder,
  options: EmailOptions
): BuiltEmail {
  const n = order.order_number;
  switch (kind) {
    case "ready_for_pickup": {
      const how = options.pickupInstructions?.trim();
      return letter(order, options, `Your order #${n} is ready for pickup`, [
        `Your order #${n} is packed and ready to pick up.`,
        "",
        ...(how ? ["How to pick it up:", how] : ["Reply to this email and we'll set a time."]),
        "",
        ...itemLines(order),
      ]);
    }
    case "out_for_delivery":
      return letter(order, options, `Your order #${n} is out for delivery`, [
        `Your order #${n} is on its way to you today, to:`,
        ...addressLines(order),
        "",
        ...itemLines(order),
      ]);
    case "shipped": {
      const carrier = order.tracking_carrier && order.tracking_carrier !== "Other" ? order.tracking_carrier : null;
      const link = trackingUrl(order.tracking_carrier, order.tracking_number);
      return letter(order, options, `Your order #${n} has shipped`, [
        `Your order #${n} is in the mail${carrier ? ` with ${carrier}` : ""}, going to:`,
        ...addressLines(order),
        "",
        ...(order.tracking_number ? [`Tracking number: ${order.tracking_number}`] : []),
        ...(link ? [`Track it: ${link}`] : []),
        "",
        ...itemLines(order),
      ]);
    }
    case "delivered":
      return letter(order, options, `Your order #${n} was delivered`, [
        `Your order #${n} has been delivered. Enjoy your pickles!`,
        "",
        "If anything is wrong with it, reply to this email and we'll make it right.",
      ]);
    case "cancelled":
      if (order.fulfillment_type === "class") {
        return letter(order, options, `Your class booking #${n} is cancelled`, [
          `We cancelled your Learn to Preserve booking #${n}.`,
          "",
          order.refunded_cents >= order.total_cents && order.total_cents > 0
            ? `We refunded your payment of ${formatPrice(order.total_cents)} in full. ${BANK_NOTE}`
            : "If a refund is due, it goes back to your card, and we'll email you when we send it.",
        ]);
      }
      return letter(order, options, `Your order #${n} is cancelled`, [
        `We cancelled your order #${n}.`,
        "",
        order.refunded_cents >= order.total_cents && order.total_cents > 0
          ? `We refunded your payment of ${formatPrice(order.total_cents)} in full. ${BANK_NOTE}`
          : "If money is due back to you, it goes back to your card, and we'll email you when we send it.",
      ]);
  }
}

/** The email for one refund. order.refunded_cents is the total refunded so far. */
export function buildRefundEmail(order: EmailOrder, amountCents: number, options: EmailOptions): BuiltEmail {
  const n = order.order_number;
  const full = order.refunded_cents >= order.total_cents;
  const soFar =
    !full && order.refunded_cents > amountCents
      ? [`So far we've refunded ${formatPrice(order.refunded_cents)} of the ${formatPrice(order.total_cents)} you paid.`]
      : [];
  return letter(order, options, `Your refund for order #${n}`, [
    `We refunded ${formatPrice(amountCents)} to your card for order #${n}.`,
    ...(full ? ["That refunds the whole order."] : soFar),
    BANK_NOTE,
  ]);
}
