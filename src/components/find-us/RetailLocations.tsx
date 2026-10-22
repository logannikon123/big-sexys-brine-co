import Image from "next/image";
import { Clock, ExternalLink, MapPin, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RetailLocation } from "@/types";

/** Opens the address in Google Maps. */
function mapsUrl(location: RetailLocation): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${location.name}, ${location.address}`
  )}`;
}

/** A Google search for the store, which shows its website and phone number. */
function searchUrl(location: RetailLocation): string {
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${location.name} ${location.address}`
  )}`;
}

const linkClass =
  "flex items-center gap-1 text-brand-cream/60 hover:text-brand-orange transition-colors";

function RetailLocationCard({ location }: { location: RetailLocation }) {
  return (
    <div className="bg-card border border-brand-brown/20 rounded-xl p-6 flex gap-5 hover:border-brand-orange/30 transition-colors">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-brown/10">
        {location.image_url ? (
          <Image
            src={location.image_url}
            alt={location.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-cream/30">
            <Store size={28} aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-grow space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-xl font-semibold text-brand-cream">
            {location.name}
          </h3>
          {location.is_pickup_location && (
            <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20">
              Online order pickup
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-1.5 text-sm text-brand-cream/50">
          <a
            href={mapsUrl(location)}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <MapPin size={14} className="shrink-0" />
            <span>
              {location.address}
              <span className="sr-only"> (get directions, opens in a new tab)</span>
            </span>
          </a>
          {location.hours && (
            <span className="flex items-center gap-1">
              <Clock size={14} className="shrink-0" />
              {location.hours}
            </span>
          )}
          <a
            href={searchUrl(location)}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <ExternalLink size={14} className="shrink-0" />
            <span>
              Website &amp; phone
              <span className="sr-only"> (opens a Google search in a new tab)</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

/** The Find Us page's list of stores that carry the jars. Renders nothing when there are none. */
export function RetailLocations({ locations }: { locations: RetailLocation[] }) {
  if (locations.length === 0) return null;
  return (
    <div className="mb-16">
      <h2 className="font-display text-2xl font-bold text-brand-cream mb-2">
        Retail Locations
      </h2>
      <p className="text-brand-cream/60 mb-6">
        Grab a jar off the shelf at these shops.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {locations.map((location) => (
          <RetailLocationCard key={location.id} location={location} />
        ))}
      </div>
    </div>
  );
}
