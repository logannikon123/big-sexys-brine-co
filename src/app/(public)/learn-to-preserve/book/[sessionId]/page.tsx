import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { BookingForm } from "@/components/classes/BookingForm";
import { UPCOMING_CLASSES_ID } from "@/components/classes/UpcomingClasses";
import { CLASS_POLICY_TEXT, classDay, classTime } from "@/lib/classes/format";
import { getUpcomingClassSession } from "@/lib/classes/sessions";
import { formatPrice } from "@/lib/utils";
import { CLASS_DISCOUNT_PERCENT, type PublicClassSession } from "@/types/classes";

export const metadata: Metadata = {
  title: "Book a Class",
  description: "Book seats at a Learn to Preserve class with Big Sexy's Brine Co.",
  robots: { index: false },
};

// Seats change with every booking, so build the page fresh on each visit.
export const dynamic = "force-dynamic";

const CLASS_PAGE = `/learn-to-preserve#${UPCOMING_CLASSES_ID}`;

/**
 * The booking page for one class date: when and where, the price and seats
 * left, the class policy, and the booking form. The booking route
 * (src/app/api/classes/book/route.ts) checks the seats and price again
 * before it charges anything.
 */
export default async function BookClassPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!/^\d{1,12}$/.test(sessionId)) notFound();

  const session = await getUpcomingClassSession(Number(sessionId));

  return (
    <section className="pt-28 pb-24">
      <Container className="max-w-3xl">
        <p className="mb-2 text-sm">
          <Link href={CLASS_PAGE} className="text-brand-cream/60 underline hover:text-brand-orange">
            Back to class dates
          </Link>
        </p>
        <h1 className="mb-8 font-display text-4xl font-bold text-brand-cream sm:text-5xl">
          Book a Class
        </h1>
        <BookingBody session={session} />
      </Container>
    </section>
  );
}

function BookingBody({ session }: { session: PublicClassSession | null | "error" }) {
  if (session === "error") {
    return (
      <Notice>
        We can&apos;t load this class right now. Please try again in a few minutes, or{" "}
        <Link href="/contact?subject=class" className="underline hover:text-brand-orange">
          contact us
        </Link>
        .
      </Notice>
    );
  }
  if (session === null) {
    return (
      <Notice>
        That class date isn&apos;t available.{" "}
        <Link href={CLASS_PAGE} className="underline hover:text-brand-orange">
          Pick another date
        </Link>
        .
      </Notice>
    );
  }

  const soldOut = session.seats_left <= 0;

  return (
    <div className="space-y-8">
      <SessionSummary session={session} />
      {soldOut ? (
        <Notice>
          This class is sold out.{" "}
          <Link href={CLASS_PAGE} className="underline hover:text-brand-orange">
            Pick another date
          </Link>
          , or{" "}
          <Link href="/contact?subject=class" className="underline hover:text-brand-orange">
            ask us about the next one
          </Link>
          .
        </Notice>
      ) : !session.booking_open ? (
        <Notice>
          Booking for this class has closed. We stop taking bookings a day before each class.{" "}
          <Link href={CLASS_PAGE} className="underline hover:text-brand-orange">
            Pick another date
          </Link>
          , or{" "}
          <Link href="/contact?subject=class" className="underline hover:text-brand-orange">
            contact us
          </Link>
          .
        </Notice>
      ) : (
        <BookingForm
          sessionId={session.id}
          priceCents={session.price_cents}
          seatsLeft={session.seats_left}
        />
      )}
    </div>
  );
}

function SessionSummary({ session }: { session: PublicClassSession }) {
  return (
    <div className="space-y-4 rounded-xl border border-brand-brown/20 bg-card p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold text-brand-cream">Learn to Preserve</h2>
      <p className="flex items-start gap-2 text-brand-cream">
        <CalendarDays size={20} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden="true" />
        <span>
          <span className="font-semibold">{classDay(session.starts_at)}</span>
          <span className="block text-brand-cream/70">
            {classTime(session.starts_at)} to {classTime(session.ends_at)}
          </span>
        </span>
      </p>
      <p className="flex items-start gap-2 text-brand-cream">
        <MapPin size={20} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden="true" />
        <span className="min-w-0 break-words">
          <span className="font-semibold">{session.location_name}</span>
          {session.location_address && (
            <span className="block text-brand-cream/70">{session.location_address}</span>
          )}
        </span>
      </p>
      <p className="flex items-start gap-2 text-brand-cream">
        <Users size={20} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden="true" />
        <span>
          <span className="font-semibold text-brand-gold">{formatPrice(session.price_cents)}</span> a seat
          {" · "}
          {session.seats_left > 0 ? `${session.seats_left} of ${session.seats} seats left` : "Sold out"}
        </span>
      </p>
      <p className="text-sm text-brand-cream/70">
        The day after class, we&apos;ll email you a code for {CLASS_DISCOUNT_PERCENT}% off a jar order.
      </p>
      <div id="class-policy" className="scroll-mt-28 border-t border-brand-brown/30 pt-4 text-sm text-brand-cream/70">
        <h3 className="mb-1 font-semibold text-brand-cream">Class policy</h3>
        <p>{CLASS_POLICY_TEXT}</p>
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-brand-brown/20 bg-card p-6 text-brand-cream/80">
      {children}
    </p>
  );
}
