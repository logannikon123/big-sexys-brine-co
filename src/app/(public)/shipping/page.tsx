// DRAFT for Jesse to review. This page is a plain-English starting point,
// not legal advice. Check it (or have a lawyer check it) before the online
// store opens.
import {
  PolicyLink,
  PolicyList,
  PolicyPage,
  PolicySection,
} from "@/components/legal/PolicyPage";
import type { Metadata } from "next";

const description =
  "How to get your jars from Big Sexy's Brine Co.: pickup in Wheat Ridge, local delivery in the Denver metro area, or shipping to Colorado addresses.";

export const metadata: Metadata = {
  title: "Shipping, Delivery and Pickup",
  description,
  openGraph: {
    title: "Shipping, Delivery and Pickup | Big Sexy's Brine Co.",
    description,
    images: [{ url: "/images/logo/logo-transparent.png" }],
  },
};

const boxExamples = [
  { jars: "1 to 3 jars", boxes: "1 box", fee: "$10" },
  { jars: "4 to 6 jars", boxes: "2 boxes", fee: "$20" },
  { jars: "7 to 9 jars", boxes: "3 boxes", fee: "$30" },
];

export default function ShippingPage() {
  return (
    <PolicyPage
      eyebrow="Getting Your Jars"
      title="Shipping, Delivery and Pickup"
      lastUpdated="October 2026"
      intro="You can pick up your order in Wheat Ridge, have us deliver it in parts of the Denver metro area, or have it shipped to a Colorado address."
    >
      <PolicySection title="Three ways to get your order">
        <PolicyList>
          <li>
            <strong className="text-brand-cream">Local pickup in Wheat Ridge.</strong>{" "}
            Choose pickup at checkout. We send the pickup address and times
            with your order confirmation.
          </li>
          <li>
            <strong className="text-brand-cream">Local delivery.</strong> We
            deliver to parts of the Denver metro area. Enter your ZIP code at
            checkout to see if we deliver to you, what it costs and which days
            we deliver.
          </li>
          <li>
            <strong className="text-brand-cream">Shipping.</strong> We ship to
            Colorado addresses. Read on for the details.
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="We ship within Colorado only, for now">
        <p>
          We make our jars under Colorado&apos;s cottage food law, which lets
          small producers sell food made in a home kitchen. That law does not
          allow sales to other states, so we can only ship to Colorado
          addresses. We hope to ship farther in the future.
        </p>
      </PolicySection>

      <PolicySection title="Packing and postage">
        <p>
          Glass jars need care on the road. We pack them in padded boxes that
          hold up to three jars each. Shipped orders pay a packing fee of $10
          per box, plus postage. Checkout works out the postage from your ZIP
          code before you pay.
        </p>
        <div className="overflow-hidden rounded-xl border border-brand-brown/30">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Packing fee by number of jars</caption>
            <thead className="bg-card text-brand-cream">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Jars</th>
                <th scope="col" className="px-4 py-3 font-semibold">Boxes</th>
                <th scope="col" className="px-4 py-3 font-semibold">Packing fee</th>
              </tr>
            </thead>
            <tbody>
              {boxExamples.map((row) => (
                <tr key={row.jars} className="border-t border-brand-brown/30">
                  <td className="px-4 py-3">{row.jars}</td>
                  <td className="px-4 py-3">{row.boxes}</td>
                  <td className="px-4 py-3">{row.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          And so on: every three jars adds another box. Pickup and local
          delivery orders do not pay the packing fee.
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
          arrives broken, email us a photo within 48 hours of delivery and we
          will replace it or refund it. Our{" "}
          <PolicyLink href="/refunds">Refunds and Cancellations</PolicyLink>{" "}
          page explains how.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
