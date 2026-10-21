import { Container } from "@/components/layout/Container";
import { getUpcomingEvents, getPastEvents, getRetailLocations } from "@/lib/data";
import { RetailLocations } from "@/components/find-us/RetailLocations";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, MapPin, Clock, Repeat } from "lucide-react";
import { RichTextContent } from "@/components/ui/rich-text-content";
import Link from "next/link";
import { EventJsonLd } from "@/components/seo/JsonLd";
import type { Metadata } from "next";
import type { Event } from "@/types";

export const metadata: Metadata = {
  title: "Find Us",
  description:
    "Find Big Sexy's Brine Co. in shops, and at farmers markets, festivals, and pop-ups across the Denver metro area. Come say hi and grab a jar.",
  openGraph: {
    title: "Find Us | Big Sexy's Brine Co.",
    description: "Find Big Sexy's in shops and at farmers markets, festivals, and pop-ups across Denver. Come say hi and grab a jar.",
    images: [{ url: "/images/logo/logo-transparent.png" }],
  },
};

function formatEventDate(event: Event): string {
  const startDate = new Date(event.date);
  if (event.is_recurring && event.recurrence_day && event.end_date) {
    const endDate = new Date(event.end_date);
    return `Every ${event.recurrence_day}, ${startDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })} – ${endDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  }
  if (event.end_date) {
    const endDate = new Date(event.end_date);
    const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
    if (sameMonth) {
      return `${startDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })} – ${endDate.toLocaleDateString("en-US", {
        day: "numeric",
        year: "numeric",
      })}`;
    }
    return `${startDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })} – ${endDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  }
  return startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventDateBadge(event: Event): { top: string; bottom: string } {
  const startDate = new Date(event.date);
  if (event.is_recurring && event.recurrence_day) {
    return {
      top: event.recurrence_day.slice(0, 3).toUpperCase(),
      bottom: startDate.toLocaleDateString("en-US", { month: "short" }) + " – " + (event.end_date ? new Date(event.end_date).toLocaleDateString("en-US", { month: "short" }) : ""),
    };
  }
  if (event.end_date) {
    const endDate = new Date(event.end_date);
    return {
      top: `${startDate.getDate()}–${endDate.getDate()}`,
      bottom: startDate.toLocaleDateString("en-US", { month: "short" }),
    };
  }
  return {
    top: String(startDate.getDate()),
    bottom: startDate.toLocaleDateString("en-US", { month: "short" }),
  };
}

export default async function EventsPage() {
  const [upcoming, past, stores] = await Promise.all([
    getUpcomingEvents(),
    getPastEvents(),
    getRetailLocations(),
  ]);

  return (
    <>
      {upcoming.map((event) => (
        <EventJsonLd key={event.id} event={event} />
      ))}
      <section className="pt-28 pb-24">
        <Container>
          <div className="text-center mb-12">
            <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20 mb-4">
              Stores &amp; Markets
            </Badge>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-brand-cream">
            Find Us
          </h1>
          <p className="mt-4 text-brand-cream/60 max-w-2xl mx-auto text-lg">
            Pick up a jar at a shop near you, or catch us in person: we set up,
            we hand out samples, we talk your ear off about brine ratios.
          </p>
        </div>

        {/* Retail Locations */}
        <RetailLocations locations={stores} />

        {/* Upcoming Events */}
        <div className="mb-16">
          <h2 className="font-display text-2xl font-bold text-brand-cream mb-6">
            Upcoming Events
          </h2>
          {upcoming.length > 0 ? (
            <div className="space-y-4">
              {upcoming.map((event) => {
                const badge = formatEventDateBadge(event);
                return (
                  <div
                    key={event.id}
                    className="bg-card border border-brand-brown/20 rounded-xl p-6 flex flex-col sm:flex-row gap-6 hover:border-brand-orange/30 transition-colors"
                  >
                    <div className="flex-shrink-0 text-center sm:text-left">
                      <div className="inline-flex flex-col items-center bg-brand-orange/10 rounded-xl px-5 py-3">
                        <span className="text-3xl font-bold text-brand-orange">
                          {badge.top}
                        </span>
                        <span className="text-sm text-brand-orange/80 uppercase font-semibold">
                          {badge.bottom}
                        </span>
                      </div>
                    </div>
                    <div className="flex-grow space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-xl font-semibold text-brand-cream">
                          {event.name}
                        </h3>
                        <Badge
                          className={
                            event.type === "festival"
                              ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20"
                              : event.type === "class"
                                ? "bg-brand-green/10 text-brand-green border-brand-green/20"
                                : "bg-brand-gold/10 text-brand-gold border-brand-gold/20"
                          }
                        >
                          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                        </Badge>
                        {event.is_recurring && (
                          <Badge className="bg-brand-green/10 text-brand-green border-brand-green/20">
                            <Repeat size={12} className="mr-1" />
                            Recurring
                          </Badge>
                        )}
                      </div>
                      {event.description && (
                        <RichTextContent html={event.description} className="prose-p:text-brand-cream/60" />
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-brand-cream/50">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatEventDate(event)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {event.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {event.location}
                          {event.address && `, ${event.address}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-brand-brown/20 rounded-xl p-12 text-center">
              <p className="text-brand-cream/60 text-lg">
                Nothing on the calendar just yet — but we&apos;re always
                cooking something up. Follow us on Instagram to be the first
                to know.
              </p>
              <a
                href="https://www.instagram.com/bigsexysbrineco"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-brand-orange hover:text-brand-gold font-semibold transition-colors"
              >
                @bigsexysbrineco
              </a>
            </div>
          )}
        </div>

        {/* Past Events */}
        {past.length > 0 && (
          <div>
            <Separator className="bg-brand-brown/20 mb-12" />
            <h2 className="font-display text-2xl font-bold text-brand-cream/50 mb-6">
              Past Events
            </h2>
            <div className="space-y-3 opacity-60">
              {past.map((event) => (
                <div
                  key={event.id}
                  className="bg-card/50 border border-brand-brown/10 rounded-lg p-4 flex items-center gap-4"
                >
                  <span className="text-sm text-brand-cream/40 w-28 shrink-0">
                    {event.is_recurring && event.end_date
                      ? `thru ${new Date(event.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : new Date(event.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                  </span>
                  <span className="text-brand-cream/50">{event.name}</span>
                  <Badge
                    variant="outline"
                    className="text-xs border-brand-brown/20 text-brand-cream/30 ml-auto"
                  >
                    {event.type}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 bg-card border border-brand-brown/20 rounded-xl p-8 text-center">
          <h3 className="font-display text-2xl font-bold text-brand-cream mb-3">
            Want Us at Your Event?
          </h3>
          <p className="text-brand-cream/60 mb-6 max-w-xl mx-auto">
            Got a market, festival, or pop-up that needs some heat? We&apos;re
            always down to set up shop somewhere new.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center px-6 py-3 bg-brand-orange text-white font-semibold rounded-full hover:bg-brand-orange/90 transition-colors"
          >
            Get in Touch
          </Link>
        </div>
      </Container>
    </section>
    </>
  );
}
