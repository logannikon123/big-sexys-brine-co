import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { ProductCard } from "@/components/products/ProductCard";
import { getFeaturedProducts, getUpcomingEvents, getTestimonials } from "@/lib/data";
import { Calendar, MapPin, ArrowRight, Quote, Instagram } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { HomeBannerView } from "@/components/home/HomeBannerView";
import { BannerErrorBoundary } from "@/components/home/BannerErrorBoundary";
import { getHomeBanner } from "@/lib/home-banner-server";
import { isBannerShowing, pickNextEvent, resolveBanner } from "@/lib/home-banner";
import { formatEventDay } from "@/lib/event-dates";

export const revalidate = 60;

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts();
  const upcomingEvents = (await getUpcomingEvents()).slice(0, 3);
  const testimonials = await getTestimonials();

  // The admin-controlled banner. Whether it shows, and which event is next,
  // is worked out each time the page is rebuilt (about once a minute), so
  // start and stop times and the "Next event" card move on by themselves.
  const savedBanner = await getHomeBanner();
  const now = new Date();
  const banner =
    savedBanner && isBannerShowing(savedBanner.settings, savedBanner.slides.length, now)
      ? resolveBanner(savedBanner, {
          now,
          nextEvent: pickNextEvent(await getUpcomingEvents(), now),
        })
      : null;

  return (
    <>
      {/* Home page banner (Admin, Home banner). Shows nothing while it's off.
          If it breaks, the two wrappers hide it and the page carries on. */}
      {banner && (
        <BannerErrorBoundary>
          <Suspense fallback={null}>
            <div className="overflow-x-clip bg-brand-black pt-24 pb-12">
              <Container>
                <HomeBannerView banner={banner} />
              </Container>
            </div>
          </Suspense>
        </BannerErrorBoundary>
      )}

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden texture-grain">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black via-brand-black/95 to-brand-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-orange/10 via-transparent to-transparent" />
        <Container className="relative z-10 py-32">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="relative">
              <div className="absolute -inset-4 bg-brand-orange/20 rounded-full blur-3xl" />
              <Image
                src="/images/logo/logo-transparent.png"
                alt="Big Sexy's Brine Co."
                width={280}
                height={280}
                className="relative rounded-full shadow-2xl shadow-brand-orange/20"
                priority
              />
            </div>
            <div className="space-y-4 max-w-3xl">
              <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold text-brand-cream leading-tight">
                Brined to{" "}
                <span className="text-gradient">Perfection</span>
              </h1>
              <p className="text-lg sm:text-xl text-brand-cream/70 max-w-2xl mx-auto leading-relaxed">
                15 varieties of bold, handcrafted preserved foods — born in Wheat Ridge, Colorado
                and built on grit, flavor, and a whole lot of heart.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-8 py-4 bg-brand-orange text-white font-semibold rounded-full hover:bg-brand-orange/90 transition-all hover:scale-105 text-lg"
              >
                See the Lineup
                <ArrowRight size={20} />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-brand-cream/30 text-brand-cream font-semibold rounded-full hover:border-brand-orange hover:text-brand-orange transition-all text-lg"
              >
                The Story
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Featured Products */}
      <section className="py-24 bg-brand-black texture-grain">
        <Container>
          <div className="text-center mb-12">
            <Badge className="bg-brand-orange/10 text-brand-orange border-brand-orange/20 mb-4">
              The Lineup
            </Badge>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-brand-cream">
              Grab a Jar
            </h2>
            <p className="mt-4 text-brand-cream/60 max-w-2xl mx-auto">
              No shortcuts, no filler — just real ingredients and flavors worth
              fighting over. These are the ones that disappear first at the market.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-brand-orange hover:text-brand-gold font-semibold transition-colors"
            >
              See All 15 Varieties
              <ArrowRight size={18} />
            </Link>
          </div>
        </Container>
      </section>

      {/* Brand Story Teaser */}
      <section className="py-24 bg-gradient-to-b from-brand-black to-brand-brown/20 texture-grain">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20">
                The Story
              </Badge>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-brand-cream leading-tight">
                Born from Resilience,{" "}
                <span className="text-gradient">Built with Heart</span>
              </h2>
              <div className="space-y-4 text-brand-cream/70 leading-relaxed">
                <p>
                  This brand wasn&apos;t born in a boardroom. It was born from
                  rock bottom, recovery, and a recipe that was too good to keep
                  to ourselves. When you grab a jar, you&apos;re not just getting
                  incredible flavor — you&apos;re backing a comeback story and
                  a family that&apos;s building something real.
                </p>
                <p className="font-display text-xl text-brand-cream italic">
                  &ldquo;Every jar is proof that second chances taste pretty damn good.&rdquo;
                </p>
              </div>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-brand-orange hover:text-brand-gold font-semibold transition-colors"
              >
                Read the Full Story
                <ArrowRight size={18} />
              </Link>
            </div>
            <div className="relative">
              <div className="aspect-square relative rounded-2xl overflow-hidden border border-brand-brown/30">
                <Image
                  src="/images/gallery/jesse-escabeche.jpg"
                  alt="Big Sexy's Brine Co. founder Jesse Thompson"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-brand-orange text-white px-6 py-3 rounded-xl font-display font-bold text-lg shadow-xl">
                Est. 2025
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-brand-black texture-grain">
        <Container>
          <div className="text-center mb-12">
            <Badge className="bg-brand-green/10 text-brand-green border-brand-green/20 mb-4">
              Real People. Real Flavor.
            </Badge>
            <h2 className="font-display text-4xl font-bold text-brand-cream">
              Word on the Street
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.slice(0, 3).map((t) => (
              <div
                key={t.id}
                className="bg-card border border-brand-brown/20 rounded-xl p-6 space-y-4"
              >
                <Quote size={24} className="text-brand-orange/40" />
                <div className="text-brand-cream/80 leading-relaxed italic">
                  <RichTextContent html={t.quote} className="prose-p:text-brand-cream/80 prose-p:italic" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-brand-cream">{t.author}</p>
                  {t.product && (
                    <Badge variant="outline" className="text-xs border-brand-orange/30 text-brand-orange/70">
                      {t.product}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Win a Free Jar Contest */}
      <section className="py-16 bg-gradient-to-r from-brand-orange/10 via-brand-gold/10 to-brand-orange/10 border-y border-brand-orange/20">
        <Container>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="space-y-2">
              <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20">
                Contest
              </Badge>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-brand-cream">
                Win a Free Jar of Pickles
              </h2>
              <p className="text-brand-cream/60 max-w-lg">
                Think you&apos;re a big dill? Submit your best pickle pun and win a free jar — your choice of flavor.
              </p>
            </div>
            <Link
              href="/contest"
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-orange text-white font-semibold rounded-full hover:bg-brand-orange/90 transition-all hover:scale-105 text-lg shrink-0"
            >
              Enter Now
              <ArrowRight size={20} />
            </Link>
          </div>
        </Container>
      </section>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="py-24 bg-gradient-to-b from-brand-black to-brand-brown/10">
          <Container>
            <div className="text-center mb-12">
              <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20 mb-4">
                Markets & Festivals
              </Badge>
              <h2 className="font-display text-4xl font-bold text-brand-cream">
                Catch Us Live
              </h2>
              <p className="mt-4 text-brand-cream/60 max-w-xl mx-auto">
                Come say hi, grab some samples, and take home a jar (or five).
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-card border border-brand-brown/20 rounded-xl p-6 space-y-3 hover:border-brand-gold/30 transition-colors"
                >
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
                  <h3 className="font-display text-xl font-semibold text-brand-cream">
                    {event.name}
                  </h3>
                  <div className="space-y-1 text-sm text-brand-cream/60">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      {formatEventDay(event.date, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} />
                      {event.location}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 text-brand-gold hover:text-brand-orange font-semibold transition-colors"
              >
                See Where We&apos;ll Be
                <ArrowRight size={18} />
              </Link>
            </div>
          </Container>
        </section>
      )}

      {/* Instagram / Social */}
      <section className="py-24 bg-brand-black texture-grain">
        <Container>
          <div className="flex flex-col items-center text-center space-y-6">
            <Instagram size={48} className="text-brand-orange" />
            <h2 className="font-display text-4xl font-bold text-brand-cream">
              Follow the Journey
            </h2>
            <p className="text-brand-cream/60 max-w-xl">
              New flavors, market drops, kitchen chaos, and the stuff that
              doesn&apos;t make it onto the label. This is where it all happens first.
            </p>
            <a
              href="https://www.instagram.com/bigsexysbrineco"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-orange to-brand-gold text-white font-semibold rounded-full hover:opacity-90 transition-opacity text-lg"
            >
              <Instagram size={20} />
              @bigsexysbrineco
            </a>
            <Image
              src="/images/instagram-qr.png"
              alt="Scan to follow on Instagram"
              width={150}
              height={150}
              className="rounded-xl mt-4 opacity-80 hover:opacity-100 transition-opacity"
            />
          </div>
        </Container>
      </section>
    </>
  );
}
