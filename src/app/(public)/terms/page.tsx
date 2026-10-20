// DRAFT for Jesse to review. This page is a plain-English starting point,
// not legal advice. Check it (or have a lawyer check it) before the online
// store opens.
import { CottageFoodNotice } from "@/components/legal/CottageFoodNotice";
import {
  PolicyLink,
  PolicyPage,
  PolicySection,
} from "@/components/legal/PolicyPage";
import type { Metadata } from "next";

const description =
  "The terms that apply when you buy from Big Sexy's Brine Co.: prices, who can order, where we deliver, allergens and our cottage food notice.";

export const metadata: Metadata = {
  title: "Terms of Sale",
  description,
  openGraph: {
    title: "Terms of Sale | Big Sexy's Brine Co.",
    description,
    images: [{ url: "/images/logo/logo-transparent.png" }],
  },
};

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="The Fine Print"
      title="Terms of Sale"
      lastUpdated="October 2026"
      intro="These terms apply when you buy jars from Big Sexy's Brine Co., a small-batch maker of preserved foods in Wheat Ridge, Colorado. By placing an order, you agree to them."
    >
      <PolicySection title="Prices and payment">
        <p>
          All prices are in US dollars. Checkout shows the full cost before
          you pay, including any delivery fee, packing fee, postage and tax.
          You pay by card when you place your order.
        </p>
      </PolicySection>

      <PolicySection title="For your own table, not for resale">
        <p>
          We sell our jars for personal use only. Please don&apos;t buy them
          to resell. If you run a shop or restaurant and want to talk,{" "}
          <PolicyLink href="/contact">say hello</PolicyLink>.
        </p>
      </PolicySection>

      <PolicySection title="Where we deliver">
        <p>
          For now we deliver and ship to Colorado addresses only. See{" "}
          <PolicyLink href="/shipping">Shipping, Delivery and Pickup</PolicyLink>{" "}
          for pickup, delivery areas, fees and timing.
        </p>
      </PolicySection>

      <PolicySection title="Ingredients and allergens">
        <p>
          Each product page and each jar label lists the ingredients and
          allergens. If you have a food allergy, please read them before you
          order and again before you eat. Our kitchen is a home kitchen that
          may also handle other common allergens.
        </p>
      </PolicySection>

      <PolicySection title="Cottage food notice">
        <p>
          We make our jars under Colorado&apos;s cottage food law, which
          requires this notice:
        </p>
        <CottageFoodNotice className="text-base text-brand-cream bg-card border border-brand-brown/30 rounded-xl p-4" />
      </PolicySection>

      <PolicySection title="Orders we can't fill">
        <p>
          We may cancel an order we can&apos;t fill, for example if a jar
          sells out or we can&apos;t deliver to your address. If we do, we
          will tell you and refund you in full for anything we can&apos;t
          send. Our{" "}
          <PolicyLink href="/refunds">Refunds and Cancellations</PolicyLink>{" "}
          page covers the rest.
        </p>
      </PolicySection>

      <PolicySection title="Your information">
        <p>
          Our <PolicyLink href="/privacy">Privacy Policy</PolicyLink> explains
          what we collect when you order and how we use it.
        </p>
      </PolicySection>

      <PolicySection title="Changes to these terms">
        <p>
          We may update these terms. The terms posted when
          you place an order are the ones that apply to it.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
