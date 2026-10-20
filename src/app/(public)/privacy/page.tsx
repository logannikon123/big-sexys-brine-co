// DRAFT for Jesse to review. This page is a plain-English starting point,
// not legal advice. Check it (or have a lawyer check it) before the online
// store opens. Keep it in step with the site: if you add a new service
// (analytics, a mailing list), list it here.
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
      intro="We collect only what we need to fill your orders and answer your messages. We never sell it."
    >
      <PolicySection title="What we collect">
        <p>When you place an order, we collect:</p>
        <PolicyList>
          <li>your name, email address and phone number</li>
          <li>your delivery or shipping address, if you choose delivery or shipping</li>
          <li>what you ordered, what you paid and how you chose to get it</li>
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
          store your full card number.
        </p>
      </PolicySection>

      <PolicySection title="Why we collect it">
        <PolicyList>
          <li>to fill, pack and deliver your order</li>
          <li>to contact you about your order, for example if a jar sells out</li>
          <li>to answer your messages</li>
          <li>to run the contest and contact the winners</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="Who handles it for us">
        <p>
          We use a few companies to run the site and the store. Each one gets
          only the information it needs to do its job:
        </p>
        <PolicyList>
          <li>
            <strong className="text-brand-cream">Square</strong> takes card
            payments.
          </li>
          <li>
            <strong className="text-brand-cream">Supabase</strong> stores our
            order records and contest entries.
          </li>
          <li>
            <strong className="text-brand-cream">Resend</strong> sends our
            emails: order emails to you, and messages from the contact and
            contest forms to our inbox.
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
