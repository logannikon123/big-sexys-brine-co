"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, Phone } from "lucide-react";
import { Container } from "./Container";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { CartButton } from "@/components/cart/CartButton";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "The Lineup" },
  { href: "/about", label: "The Story" },
  { href: "/events", label: "Find Us" },
  { href: "/learn-to-preserve", label: "Take a Class" },
  { href: "/gallery", label: "Behind the Jars" },
  { href: "/contest", label: "Win a Jar!" },
];

interface HeaderProps {
  /** Show the cart button. False until online ordering opens. */
  orderingAvailable?: boolean;
}

export function Header({ orderingAvailable = false }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-brand-black/95 backdrop-blur-md shadow-lg border-b border-brand-brown/30"
          : "bg-transparent"
      )}
    >
      <Container>
        <nav className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <Image
              src="/images/logo/logo-transparent.png"
              alt="Big Sexy's Brine Co."
              width={50}
              height={50}
              priority
            />
            <span className="font-display text-xl font-bold text-brand-cream hidden sm:block">
              Big Sexy&apos;s Brine Co.
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-brand-cream/80 hover:text-brand-orange transition-colors rounded-md hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            {/* With the cart button the full number no longer fits, so show
                just the phone icon. The number stays in the footer. */}
            {orderingAvailable ? (
              <a
                href="tel:+17203540527"
                aria-label="Call (720) 354-0527"
                title="(720) 354-0527"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-cream/60 hover:text-brand-orange hover:bg-white/5 transition-colors"
              >
                <Phone size={18} />
              </a>
            ) : (
              <a
                href="tel:+17203540527"
                className="inline-flex items-center gap-1.5 text-sm text-brand-cream/60 hover:text-brand-orange transition-colors"
              >
                <Phone size={14} />
                (720) 354-0527
              </a>
            )}
            <Link
              href="/contact"
              className="inline-flex items-center px-5 py-2.5 bg-brand-orange text-white text-sm font-semibold rounded-full hover:bg-brand-orange/90 transition-colors"
            >
              Say Hello
            </Link>
            {orderingAvailable && <CartButton />}
          </div>

          {/* Mobile cart button, beside the menu button */}
          {orderingAvailable && (
            <div className="ml-auto mr-1 lg:hidden">
              <CartButton />
            </div>
          )}

          {/* Mobile Nav */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <button
                className="p-2 text-brand-cream hover:text-brand-orange transition-colors"
                aria-label="Toggle menu"
              >
                {open ? <X size={24} /> : <Menu size={24} />}
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full sm:w-80 bg-brand-black border-brand-brown/30"
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col gap-2 mt-8">
                <div className="flex items-center gap-3 mb-8 px-2">
                  <Image
                    src="/images/logo/logo-transparent.png"
                    alt="Big Sexy's Brine Co."
                    width={40}
                    height={40}
                  />
                  <span className="font-display text-lg font-bold text-brand-cream">
                    Big Sexy&apos;s Brine Co.
                  </span>
                </div>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="px-4 py-3 text-lg font-medium text-brand-cream/80 hover:text-brand-orange hover:bg-white/5 transition-colors rounded-lg"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-6 px-2 space-y-3">
                  <a
                    href="tel:+17203540527"
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 border border-brand-cream/20 text-brand-cream font-medium rounded-full hover:border-brand-orange hover:text-brand-orange transition-colors"
                  >
                    <Phone size={16} />
                    (720) 354-0527
                  </a>
                  <Link
                    href="/contact"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center w-full px-5 py-3 bg-brand-orange text-white font-semibold rounded-full hover:bg-brand-orange/90 transition-colors"
                  >
                    Say Hello
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </Container>
    </header>
  );
}
