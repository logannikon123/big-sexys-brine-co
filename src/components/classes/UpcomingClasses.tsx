import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { CLASS_POLICY_TEXT, classDay, classTime } from "@/lib/classes/format";
import { formatPrice } from "@/lib/utils";
import type { PublicClassSession } from "@/types/classes";

/** Where the class page's "Upcoming Classes" list sits, for links that jump to it. */
export const UPCOMING_CLASSES_ID = "upcoming-classes";

const CONTACT_HREF = "/contact?subject=class";

const linkClass = "underline hover:text-brand-orange";

/**
 * The class dates on the Learn to Preserve page, with seats left and a Book
 * button for each. `sessions` is null when the dates couldn't be read.
 */
export function UpcomingClasses({ sessions }: { sessions: PublicClassSession[] | null }) {
  return (
    <section
      id={UPCOMING_CLASSES_ID}
      aria-labelledby="upcoming-classes-heading"
      className="mb-16 scroll-mt-28"
    >
      <h2
        id="upcoming-classes-heading"
        className="mb-6 font-display text-3xl font-bold text-brand-cream"
      >
        Upcoming Classes
      </h2>

      {sessions === null ? (
        <Notice>
          We can&apos;t show class dates right now. Please try again in a few minutes, or{" "}
          <Link href={CONTACT_HREF} className={linkClass}>
            ask us about the next class
          </Link>
          .
        </Notice>
      ) : sessions.length === 0 ? (
        <Notice>
          No dates are set yet.{" "}
          <Link href={CONTACT_HREF} className={linkClass}>
            Get in touch
          </Link>{" "}
          and we&apos;ll tell you when the next class is on.
        </Notice>
      ) : (
        <ul className="space-y-4">
          {sessions.map((session) => (
            <li key={session.id}>
              <SessionCard session={session} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm text-brand-cream/60">{CLASS_POLICY_TEXT}</p>
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-brand-brown/20 bg-card p-6 text-brand-cream/80">
      {children}
    </p>
  );
}

function SessionCard({ session }: { session: PublicClassSession }) {
  const soldOut = session.seats_left <= 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-brand-brown/20 bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0 space-y-2">
        <p className="flex items-start gap-2 font-display text-xl font-semibold text-brand-cream">
          <CalendarDays size={20} className="mt-1 shrink-0 text-brand-orange" aria-hidden="true" />
          <span>
            {classDay(session.starts_at)}
            <span className="block text-base font-normal text-brand-cream/70">
              {classTime(session.starts_at)} to {classTime(session.ends_at)}
            </span>
          </span>
        </p>
        <p className="flex items-start gap-2 text-brand-cream/70">
          <MapPin size={18} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden="true" />
          <span className="min-w-0 break-words">
            {session.location_name}
            {session.location_address && (
              <span className="block text-sm text-brand-cream/50">{session.location_address}</span>
            )}
          </span>
        </p>
        <p className="text-sm text-brand-cream/70">
          <span className="font-semibold text-brand-gold">{formatPrice(session.price_cents)}</span> a seat
          {" · "}
          {soldOut ? (
            <span className="font-semibold text-brand-red">Sold out</span>
          ) : (
            `${session.seats_left} of ${session.seats} seats left`
          )}
        </p>
      </div>

      <div className="shrink-0">
        {soldOut ? (
          <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-brown/40 px-6 py-3 font-semibold text-brand-cream/50">
            Sold out
          </span>
        ) : !session.booking_open ? (
          <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-brown/40 px-6 py-3 font-semibold text-brand-cream/50">
            Booking closed
          </span>
        ) : (
          <Link
            href={`/learn-to-preserve/book/${session.id}`}
            aria-label={`Book the class on ${classDay(session.starts_at)}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand-orange px-8 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90 sm:w-auto"
          >
            Book
          </Link>
        )}
      </div>
    </div>
  );
}
