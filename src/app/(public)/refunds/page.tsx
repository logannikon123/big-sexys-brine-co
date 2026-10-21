// DRAFT for Jesse to review. Refunds through Square match how the store
// takes payment. The rest is Jesse's policy, which no code enforces: no
// returns, the 72-hour window to report a problem, and cancelling only until
// the order is packed or out for delivery. Take this marker off once he
// confirms them. This page is a plain-English starting point, not legal
// advice.
import {
  POLICY_EMAIL,
  PolicyLink,
  PolicyList,
  PolicyPage,
  PolicySection,
} from "@/components/legal/PolicyPage";
import type { Metadata } from "next";

const description =
  "Big Sexy's Brine Co. refund and cancellation policy: what to do if an order arrives damaged or wrong, and how to cancel an order.";

export const metadata: Metadata = {
  title: "Refunds and Cancellations",
  description,
  openGraph: {
    title: "Refunds and Cancellations | Big Sexy's Brine Co.",
    description,
    images: [{ url: "/images/logo/logo-transparent.png" }],
  },
};

export default function RefundsPage() {
  return (
    <PolicyPage
      eyebrow="Making It Right"
      title="Refunds and Cancellations"
      lastUpdated="October 2026"
      intro="We want every jar to reach you whole and taste the way it should. Here is what happens when something goes wrong."
    >
      <PolicySection title="We can't take returns">
        <p>
          Our jars are food, and food spoils. Once an order leaves our hands
          we can&apos;t take it back or swap it for something else.
        </p>
      </PolicySection>

      <PolicySection title="Damaged, leaking or wrong orders">
        <p>
          If your order arrives damaged or leaking, or we sent the wrong jars,
          we will replace them or refund them. To claim:
        </p>
        <PolicyList>
          <li>
            Email{" "}
            <PolicyLink href={`mailto:${POLICY_EMAIL}`}>{POLICY_EMAIL}</PolicyLink>{" "}
            within 72 hours of delivery or pickup.
          </li>
          <li>Include a photo of the problem and your order number.</li>
        </PolicyList>
        <p>
          Please don&apos;t eat from a jar that arrives cracked, leaking or
          with a bulging lid.
        </p>
      </PolicySection>

      <PolicySection title="Cancelling an order">
        <p>
          You can cancel for a full refund until we pack your order or send it
          out for delivery. Email or call us as soon as you can, with your
          order number. Once an order is packed or on its way, we can&apos;t
          cancel it.
        </p>
      </PolicySection>

      <PolicySection title="If we cancel">
        <p>
          Now and then we may not be able to fill an order, for example if a
          jar sells out. If that happens we will tell you and refund you in
          full for anything we can&apos;t send.
        </p>
      </PolicySection>

      <PolicySection title="How refunds are paid">
        <p>
          We refund through Square, our card processor, back to the card you
          paid with. Your bank decides how long the money takes to show up,
          often a few business days.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
