import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// Shared layout for the store policy pages (shipping, refunds, privacy,
// terms), so they all look the same and end with the same contact details.

export const POLICY_EMAIL = "bigsexysbrineco@gmail.com";

interface PolicyPageProps {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}

export function PolicyPage({
  eyebrow,
  title,
  lastUpdated,
  intro,
  children,
}: PolicyPageProps) {
  return (
    <section className="pt-28 pb-24">
      <Container>
        <div className="max-w-3xl mx-auto">
          <header className="text-center mb-12">
            <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20 mb-4">
              {eyebrow}
            </Badge>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-brand-cream">
              {title}
            </h1>
            <p className="mt-4 text-sm text-brand-cream/60">
              Last updated: {lastUpdated}
            </p>
            <p className="mt-6 text-lg text-brand-cream/80 leading-relaxed">
              {intro}
            </p>
          </header>

          <div className="space-y-10">{children}</div>

          <div className="mt-12 bg-card border border-brand-orange/20 rounded-xl p-6 sm:p-8 space-y-3">
            <h2 className="font-display text-xl font-semibold text-brand-cream">
              Questions?
            </h2>
            <p className="text-brand-cream/80 leading-relaxed">
              Email us at <PolicyLink href={`mailto:${POLICY_EMAIL}`}>{POLICY_EMAIL}</PolicyLink>,
              call <PolicyLink href="tel:+17203540527">(720) 354-0527</PolicyLink>,
              or use our <PolicyLink href="/contact">contact form</PolicyLink>.
            </p>
            <p className="text-sm text-brand-cream/60">
              Big Sexy&apos;s Brine Co., Wheat Ridge, Colorado
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

interface PolicySectionProps {
  title: string;
  children: React.ReactNode;
}

export function PolicySection({ title, children }: PolicySectionProps) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-semibold text-brand-cream">
        {title}
      </h2>
      <div className="space-y-4 text-brand-cream/80 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function PolicyList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-6 space-y-2 marker:text-brand-orange">
      {children}
    </ul>
  );
}

interface PolicyLinkProps {
  href: string;
  children: React.ReactNode;
}

export function PolicyLink({ href, children }: PolicyLinkProps) {
  const className =
    "text-brand-orange underline underline-offset-4 hover:text-brand-gold transition-colors";
  // Site pages use Next.js links; email and phone links use a plain <a>.
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
