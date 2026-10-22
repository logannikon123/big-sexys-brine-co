// Jesse confirmed this policy in October 2026. The fees, distances, box size
// and areas below come live from Store settings and match checkout. Two
// lines are his policy, not something the code enforces: how soon orders
// usually ship, and the 72-hour window to report a broken jar. This page is
// a plain-English starting point, not legal advice.
import { CottageFoodNotice } from "@/components/legal/CottageFoodNotice";
import {
  PolicyLink,
  PolicyList,
  PolicyPage,
  PolicySection,
} from "@/components/legal/PolicyPage";
import { MAX_DELIVERY_DAYS_AHEAD, standardDays } from "@/lib/checkout/dates";
import { getStoreSettings, type PublicStoreSettings } from "@/lib/data";
import { formatPriceShort } from "@/lib/utils";
import type { Metadata } from "next";

// Read Store settings again at least once a minute, so a fee change in the
// admin shows here soon after.
export const revalidate = 60;

const description =
  "How to get your jars from Big Sexy's Brine Co.: pickup in Lakewood, local delivery in the Denver metro area, or shipping to Colorado addresses only.";

export const metadata: Metadata = {
  title: "Shipping, Delivery and Pickup",
  description,
  openGraph: {
    title: "Shipping, Delivery and Pickup | Big Sexy's Brine Co.",
    description,
    images: [{ url: "/images/logo/logo-transparent.png" }],
  },
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function jarRange(boxNumber: number, jarsPerBox: number) {
  const first = (boxNumber - 1) * jarsPerBox + 1;
  const last = boxNumber * jarsPerBox;
  return first === last ? plural(first, "jar", "jars") : `${first} to ${last} jars`;
}

function DeliveryDetails({ settings }: { settings: PublicStoreSettings | null }) {
  if (!settings) {
    return (
      <>
        We deliver across the Denver metro area. The fee depends on the
        driving distance from our kitchen, and checkout shows it once you
        enter your address. You can pick an earlier date for an extra rush
        fee, also shown at checkout.
      </>
    );
  }

  const days = standardDays(settings.delivery_standard_hours);
  const freeDelivery =
    settings.free_delivery_enabled &&
    settings.free_delivery_max_miles !== null &&
    settings.free_delivery_min_order_cents !== null;

  return (
    <>
      We deliver in the Denver metro area, up to{" "}
      {plural(settings.delivery_max_miles, "mile", "miles")} by road from our
      kitchen. The fee is {formatPriceShort(settings.delivery_fee_per_step_cents)}{" "}
      for each {plural(settings.delivery_step_miles, "mile", "miles")} of
      driving, or part of that, so a trip of{" "}
      {plural(settings.delivery_step_miles, "mile", "miles")} or less costs{" "}
      {formatPriceShort(settings.delivery_fee_per_step_cents)}. Checkout
      measures the distance and shows the fee once you enter your address.
      {settings.delivery_min_order_cents > 0 && (
        <>
          {" "}Delivery orders must come to at least{" "}
          {formatPriceShort(settings.delivery_min_order_cents)} in jars.
        </>
      )}
      {freeDelivery && (
        <>
          {" "}Delivery is free within{" "}
          {plural(settings.free_delivery_max_miles!, "mile", "miles")} on
          orders of {formatPriceShort(settings.free_delivery_min_order_cents!)}{" "}
          or more in jars.
        </>
      )}{" "}
      You choose the delivery date, from tomorrow up to{" "}
      {MAX_DELIVERY_DAYS_AHEAD} days ahead.
      {days > 1 && (
        <>
          {" "}A date {plural(days, "day", "days")} or more after the day you
          order has no rush fee. A sooner date adds a rush fee of{" "}
          {formatPriceShort(settings.rush_fee_cents)}
          {freeDelivery ? ", even on free deliveries" : ""}.
        </>
      )}
    </>
  );
}

function PackingAndPostage({ settings }: { settings: PublicStoreSettings | null }) {
  if (!settings) {
    return (
      <p>
        Glass jars need care on the road, so we pack them in padded boxes.
        Shipped orders pay a packing fee and postage for each box. Checkout
        shows both before you pay.
      </p>
    );
  }

  const jarsPerBox = Math.max(1, settings.jars_per_box);
  const packing = settings.packing_fee_per_box_cents;
  const postage =
    settings.shipping_fallback_per_box_cents + settings.shipping_cushion_per_box_cents;
  const rows = [1, 2, 3].map((boxes) => ({
    jars: jarRange(boxes, jarsPerBox),
    boxes: plural(boxes, "box", "boxes"),
    packing: formatPriceShort(boxes * packing),
    postage: formatPriceShort(boxes * postage),
    total: formatPriceShort(boxes * (packing + postage)),
  }));

  return (
    <>
      <p>
        Glass jars need care on the road. We pack them in padded boxes that
        hold up to {plural(jarsPerBox, "jar", "jars")} each. Shipped orders pay
        two charges for each box: a packing fee of {formatPriceShort(packing)}{" "}
        and postage of {formatPriceShort(postage)}. Postage is a flat price
        per box for now, wherever in Colorado the box goes. Checkout shows
        both before you pay.
      </p>
      <div className="overflow-x-auto rounded-xl border border-brand-brown/30">
        <table className="w-full text-left text-sm">
          {/* Phones skip the Boxes column so the table fits. */}
          <caption className="sr-only">Shipping charges by number of jars</caption>
          <thead className="bg-card text-brand-cream">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold sm:px-4">Jars</th>
              <th scope="col" className="hidden px-3 py-3 font-semibold sm:table-cell sm:px-4">Boxes</th>
              <th scope="col" className="px-3 py-3 font-semibold sm:px-4">Packing</th>
              <th scope="col" className="px-3 py-3 font-semibold sm:px-4">Postage</th>
              <th scope="col" className="px-3 py-3 font-semibold sm:px-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.boxes} className="border-t border-brand-brown/30">
                <td className="whitespace-nowrap px-3 py-3 sm:px-4">{row.jars}</td>
                <td className="hidden px-3 py-3 sm:table-cell sm:px-4">{row.boxes}</td>
                <td className="px-3 py-3 sm:px-4">{row.packing}</td>
                <td className="px-3 py-3 sm:px-4">{row.postage}</td>
                <td className="px-3 py-3 sm:px-4">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        And so on: every {jarsPerBox === 1 ? "jar" : `${jarsPerBox} jars`} adds
        another box. Pickup and local delivery orders pay neither charge.
      </p>
    </>
  );
}

export default async function ShippingPage() {
  const settings = await getStoreSettings();

  return (
    <PolicyPage
      eyebrow="Getting Your Jars"
      title="Shipping, Delivery and Pickup"
      lastUpdated="October 2026"
      intro="You can pick up your order in Lakewood, have us deliver it in the Denver metro area, or have it shipped to a Colorado address."
    >
      <PolicySection title="Three ways to get your order">
        <PolicyList>
          <li>
            <strong className="text-brand-cream">Pickup in Lakewood.</strong>{" "}
            Pick up free at The Karma House on West Colfax Avenue in Lakewood.
            Checkout shows the address and hours, and we include them in your
            order confirmation.
          </li>
          <li>
            <strong className="text-brand-cream">Local delivery.</strong>{" "}
            <DeliveryDetails settings={settings} />
          </li>
          <li>
            <strong className="text-brand-cream">Shipping, Colorado only.</strong>{" "}
            We ship to Colorado addresses only. Read on for the details.
          </li>
        </PolicyList>
        <p>Checkout shows which of these are open when you order.</p>
      </PolicySection>

      <PolicySection title="We ship within Colorado only">
        <p>
          We make our jars under Colorado&apos;s cottage food law, which lets
          small producers sell food made in a home kitchen. That law does not
          allow sales to other states, so we sell and ship to Colorado
          addresses only. Checkout won&apos;t take a shipping address in
          another state.
        </p>
      </PolicySection>

      <PolicySection title="Packing and postage">
        <PackingAndPostage settings={settings} />
      </PolicySection>

      <PolicySection title="Sales tax">
        <p>
          We charge the local sales tax on food where you get your jars: the
          pickup spot for pickup orders, or your address for delivery and
          shipping. If we have no rate on file for that place, we charge no
          tax. Colorado doesn&apos;t charge its state sales tax on food for
          home use, and we don&apos;t charge tax on the delivery, rush,
          packing or postage fees.
        </p>
      </PolicySection>

      <PolicySection title="When your order ships">
        <p>
          We make everything in small batches, and orders usually ship within
          a few business days. How long the trip takes after that depends on
          the carrier.
        </p>
      </PolicySection>

      <PolicySection title="If a jar arrives broken">
        <p>
          Glass sometimes breaks in transit, however well we pack it. If a jar
          arrives broken, email us a photo within 72 hours of delivery and we
          will replace it or refund it. Our{" "}
          <PolicyLink href="/refunds">Refunds and Cancellations</PolicyLink>{" "}
          page explains how.
        </p>
      </PolicySection>

      <PolicySection title="Cottage food notice">
        <p>Colorado&apos;s cottage food law requires this notice:</p>
        <CottageFoodNotice className="text-base text-brand-cream bg-card border border-brand-brown/30 rounded-xl p-4" />
      </PolicySection>
    </PolicyPage>
  );
}
