import type { Product, Event as EventType } from "@/types";
import { toPlainText } from "@/lib/plain-text";

interface JsonLdProps {
  data: Record<string, unknown>;
}

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co"
).trim();

/** Supabase images are already full URLs; only local paths need the site prefix. */
function absoluteUrl(path: string) {
  return /^https?:\/\//.test(path) ? path : `${SITE_URL}${path}`;
}

export function JsonLd({ data }: JsonLdProps) {
  // Escape "<" so admin-entered text containing "</script>" can't break out of the tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export function LocalBusinessJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Big Sexy's Brine Co.",
        description:
          "Small-batch artisan preserved foods handcrafted in Wheat Ridge, Colorado.",
        url: SITE_URL,
        logo: `${SITE_URL}/images/logo/logo-transparent.png`,
        image: `${SITE_URL}/images/logo/logo-transparent.png`,
        telephone: "+1-720-354-0527",
        email: "bigsexysbrineco@gmail.com",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Wheat Ridge",
          addressRegion: "CO",
          addressCountry: "US",
        },
        foundingDate: "2025",
        founder: {
          "@type": "Person",
          name: "Jesse Thompson",
        },
        sameAs: ["https://www.instagram.com/bigsexysbrineco"],
      }}
    />
  );
}

export function ProductJsonLd({ product }: { product: Product }) {
  // Search engines show a price only when the product has one.
  const offers =
    product.priceCents != null
      ? {
          "@type": "Offer",
          price: (product.priceCents / 100).toFixed(2),
          priceCurrency: "USD",
          availability:
            product.soldOnline && !product.soldOut
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: `${SITE_URL}/products/${product.slug}`,
        }
      : undefined;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: toPlainText(product.description),
        image: absoluteUrl(product.image),
        brand: {
          "@type": "Brand",
          name: "Big Sexy's Brine Co.",
        },
        manufacturer: {
          "@type": "Organization",
          name: "Big Sexy's Brine Co.",
        },
        category: product.category,
        ...(offers && { offers }),
      }}
    />
  );
}

export function EventJsonLd({ event }: { event: EventType }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.name,
        description: toPlainText(event.description) || `${event.name} - Big Sexy's Brine Co.`,
        startDate: event.date,
        location: {
          "@type": "Place",
          name: event.location,
          address: event.address || event.location,
        },
        organizer: {
          "@type": "Organization",
          name: "Big Sexy's Brine Co.",
          url: SITE_URL,
        },
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      }}
    />
  );
}

export function CourseJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Course",
        name: "Learn to Preserve - Hands-On Workshop",
        description:
          "A 4-hour hands-on preservation workshop teaching the art and science of brining. All skill levels welcome.",
        provider: {
          "@type": "Organization",
          name: "Big Sexy's Brine Co.",
          url: SITE_URL,
        },
        offers: {
          "@type": "Offer",
          price: "125",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "onsite",
          location: {
            "@type": "Place",
            name: "Wheat Ridge, CO",
          },
        },
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; href: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: `${SITE_URL}${item.href}`,
        })),
      }}
    />
  );
}
