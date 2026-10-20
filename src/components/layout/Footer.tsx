import Link from "next/link";
import Image from "next/image";
import { Container } from "./Container";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { CottageFoodNotice } from "@/components/legal/CottageFoodNotice";

const footerLinks = [
  { href: "/products", label: "The Lineup" },
  { href: "/about", label: "The Story" },
  { href: "/events", label: "Find Us" },
  { href: "/learn-to-preserve", label: "Take a Class" },
  { href: "/gallery", label: "Behind the Jars" },
  { href: "/contact", label: "Say Hello" },
];

const policyLinks = [
  { href: "/shipping", label: "Shipping, Delivery and Pickup" },
  { href: "/refunds", label: "Refunds and Cancellations" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Sale" },
];

export function Footer() {
  return (
    <footer className="bg-brand-black border-t border-brand-brown/30">
      <Container className="py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo/logo-transparent.png"
                alt="Big Sexy's Brine Co."
                width={50}
                height={50}
              />
              <div>
                <h3 className="font-display text-xl font-bold text-brand-cream">
                  Big Sexy&apos;s Brine Co.
                </h3>
                <p className="text-sm text-brand-cream/60">Est. 2025</p>
              </div>
            </div>
            <p className="text-brand-cream/70 text-sm leading-relaxed">
              Small-batch preserved foods made by hand in Wheat Ridge, Colorado.
            </p>
            <p className="text-brand-cream/50 text-sm italic">
              Born from resilience. Brined to perfection.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-display text-lg font-semibold text-brand-cream mb-4">
              Explore
            </h4>
            <ul className="space-y-2">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-brand-cream/70 hover:text-brand-orange transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="font-display text-lg font-semibold text-brand-cream mb-4">
              Connect
            </h4>
            <div className="space-y-3">
              <a
                href="tel:+17203540527"
                className="flex items-center gap-2 text-sm text-brand-cream/70 hover:text-brand-orange transition-colors"
              >
                <Phone size={16} />
                (720) 354-0527
              </a>
              <a
                href="mailto:bigsexysbrineco@gmail.com"
                className="flex items-center gap-2 text-sm text-brand-cream/70 hover:text-brand-orange transition-colors"
              >
                <Mail size={16} />
                bigsexysbrineco@gmail.com
              </a>
              <div className="flex items-center gap-2 text-sm text-brand-cream/70">
                <MapPin size={16} />
                Wheat Ridge, CO
              </div>
              <a
                href="https://www.instagram.com/bigsexysbrineco"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-brand-cream/70 hover:text-brand-orange transition-colors"
              >
                <Instagram size={16} />
                @bigsexysbrineco
              </a>
            </div>
            <div className="mt-6">
              <Image
                src="/images/instagram-qr.png"
                alt="Follow us on Instagram"
                width={100}
                height={100}
                className="rounded-lg opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-brand-brown/30" />

        <nav aria-label="Store policies" className="mb-6">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {policyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-brand-cream/70 hover:text-brand-orange transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <CottageFoodNotice className="mb-6 text-center" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-brand-cream/50">
            &copy; {new Date().getFullYear()} Big Sexy&apos;s Brine Co. All rights reserved.
          </p>
          <p className="text-xs text-brand-cream/50">
            Handcrafted in Wheat Ridge, Colorado
          </p>
        </div>
      </Container>
    </footer>
  );
}
