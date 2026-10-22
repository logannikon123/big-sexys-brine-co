// Checked against the code in October 2026: every service the site sends
// personal information to is listed below. This page is a plain-English
// starting point, not legal advice. Keep it in step with the site: if you
// add a new service (analytics, a mailing list), list it here. When the
// wording changes, change TERMS_VERSION in src/lib/checkout/pay.ts too.
import {
  POLICY_EMAIL,
  PolicyLink,
  PolicyList,
  PolicyPage,
  PolicySection,
} from "@/components/legal/PolicyPage";
import type { Metadata } from "next";

const description =
  "What personal information Big Sexy's Brine Co. collects, why we collect it, who handles it for us, and how to ask us to see or delete it.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description,
  openGraph: {
    title: "Privacy Policy | Big Sexy's Brine Co.",
    description,
    images: [{ url: "/images/logo/logo-transparent.png" }],
  },
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Your Information"
      title="Privacy Policy"
      lastUpdated="October 2026"
      intro="We collect only what we need to fill your orders, answer your messages and, if you ask for them, send you our news. We never sell it."
    >
      <PolicySection title="What we collect">
        <p>When you place an order, we collect:</p>
        <PolicyList>
          <li>your name and email address, and your phone number and order notes if you give them</li>
          <li>
            your delivery or shipping address, if you choose delivery or
            shipping, and where it sits on the map
          </li>
          <li>what you ordered, what you paid and how you chose to get it</li>
          <li>when you agreed to these policies</li>
        </PolicyList>
        <p>
          When you send us a message through the{" "}
          <PolicyLink href="/contact">contact form</PolicyLink>, we collect
          your name, email address and message. When you enter the{" "}
          <PolicyLink href="/contest">contest</PolicyLink>, we collect your
          name, email address and entry.
        </p>
      </PolicySection>

      <PolicySection title="Card payments">
        <p>
          Square handles all card payments. You type your card details into
          Square&apos;s secure payment form, not ours, and we never see or
          store your full card number. Square sends us back the card brand,
          the last four digits and a receipt link, and we keep those with your
          order.
        </p>
      </PolicySection>

      <PolicySection title="Why we collect it">
        <PolicyList>
          <li>to fill, pack and deliver your order</li>
          <li>to contact you about your order, for example if a jar sells out</li>
          <li>to answer your messages</li>
          <li>to run the contest and contact the winners</li>
          <li>
            to send you emails about new flavors, where to find us, coupons,
            promotions and special events, but only if you tick the box asking
            for them
          </li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="Marketing emails">
        <p>
          At checkout and on the contest form there is a box you can tick to
          get our marketing emails. It starts ticked: untick it if you don&apos;t
          want them. You don&apos;t need it to order or to enter. If you tick it, we keep a record of
          when and where you agreed, the wording you agreed to, and your
          internet address and browser at the time, so we can show you asked.
        </p>
        <p>
          You can stop these emails any time: use the unsubscribe link in any
          of them, or email{" "}
          <PolicyLink href={`mailto:${POLICY_EMAIL}`}>{POLICY_EMAIL}</PolicyLink>.
          Order emails, like your receipt, still come either way.
        </p>
      </PolicySection>

      <PolicySection title="Who handles it for us">
        <p>
          We use a few companies to run the site and the store. Each one gets
          only the information it needs to do its job:
        </p>
        <PolicyList>
          <li>
            <strong className="text-brand-cream">Square</strong> takes card
            payments. It gets your card details, your email address and the
            amount. Its payment form may also collect details about your
            device to help stop fraud.
          </li>
          <li>
            <strong className="text-brand-cream">The US Census Bureau</strong>{" "}
            runs a free address lookup (its geocoder). For delivery and
            shipping orders, we send it your street address to check it,
            find it on the map, and learn its city and county, which set the
            delivery distance and the local sales tax.
          </li>
          <li>
            <strong className="text-brand-cream">OpenRouteService</strong>{" "}
            works out the driving distance for local delivery. It gets only
            two map points (our kitchen and your address), not your name.
          </li>
          <li>
            <strong className="text-brand-cream">Supabase</strong> is our
            database. It stores our order records, contest entries and
            marketing email choices.
          </li>
          <li>
            <strong className="text-brand-cream">Resend</strong> sends our
            emails: order emails to you, order alerts to us, and messages from
            the contact and contest forms to our inbox.
          </li>
          <li>
            <strong className="text-brand-cream">Pushover</strong> sends a
            phone alert to the owner when an order comes in. The alert gives
            your name, the order number and total, how many jars, and how you
            chose to get them.
          </li>
          <li>
            <strong className="text-brand-cream">Google</strong> runs our
            email inbox (Gmail), which holds the emails you send us. Mail to
            any @bigsexysbrine.co address reaches it through{" "}
            <strong className="text-brand-cream">ImprovMX</strong>, a mail
            forwarding service. To plan a delivery, we may also look up your
            address in Google Maps.
          </li>
          <li>
            <strong className="text-brand-cream">Vercel</strong> hosts the
            website. Like any web host, it keeps short-term technical logs
            (such as IP addresses) to run and protect the site.
          </li>
        </PolicyList>
        <p>
          The site does not use analytics or advertising trackers.
        </p>
      </PolicySection>

      <PolicySection title="We never sell your information">
        <p>
          We do not sell, rent or trade your personal information, and we do
          not share it with anyone for advertising.
        </p>
      </PolicySection>

      <PolicySection title="How long we keep it">
        <p>
          We keep order records for as long as we need them to handle your
          order and for our tax and bookkeeping records.
        </p>
      </PolicySection>

      <PolicySection title="Seeing or deleting your information">
        <p>
          To see the information we hold about you, correct it or ask us to
          delete it, email{" "}
          <PolicyLink href={`mailto:${POLICY_EMAIL}`}>{POLICY_EMAIL}</PolicyLink>.
          We will reply as soon as we can. We may need to keep some order
          records where the law requires it, such as for taxes.
        </p>
      </PolicySection>

      <PolicySection title="Changes to this policy">
        <p>
          If we change this policy, we will post the new version here and
          update the date at the top of the page.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
