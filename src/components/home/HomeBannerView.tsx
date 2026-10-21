"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pause,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  THEME_CLASSES,
  type ResolvedBanner,
  type ResolvedLink,
} from "@/lib/home-banner";

/**
 * The home page banner: a photo slide show beside a headline, a message, a
 * button and the "Next event" card. The home page and the admin preview both
 * draw it from the same settings (see resolveBanner in src/lib/home-banner.ts).
 *
 * It sizes itself by the width of the box it sits in (Tailwind's @container
 * and @3xl: classes), not the width of the screen, so the narrow admin
 * preview stacks just like a phone does.
 */

interface HomeBannerViewProps {
  banner: ResolvedBanner;
  /**
   * The admin preview passes this. Links then stay on the page and report
   * where they would have gone instead.
   */
  onLinkClick?: (href: string) => void;
}

// "Reduce motion" is a phone or computer setting for people who get dizzy or
// distracted by movement. The banner then holds still unless they press play.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );
}

/**
 * The slide show's moving parts. Embla (the carousel library) does the
 * sliding and swiping; this decides when the photos turn by themselves.
 */
function useBannerCarousel(slideCount: number, autoplay: boolean, slideSeconds: number) {
  const reducedMotion = useReducedMotion();
  const several = slideCount > 1;

  // Autoplay turns the photos. It starts stopped; the effect below starts it.
  const plugins = useMemo(
    () =>
      several
        ? [
            Autoplay({
              delay: slideSeconds * 1000,
              playOnInit: false,
              stopOnInteraction: true,
              stopOnMouseEnter: false,
              stopOnFocusIn: false,
            }),
          ]
        : [],
    [several, slideSeconds]
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, watchDrag: several },
    plugins
  );

  const [selected, setSelected] = useState(0);
  // "auto" follows the admin's autoplay setting. The pause and play button
  // switches to "paused" or "playing".
  const [choice, setChoice] = useState<"auto" | "paused" | "playing">("auto");
  const [hovering, setHovering] = useState(false);
  const [focusInside, setFocusInside] = useState(false);

  // Whether the slide show is meant to run (what the pause button shows).
  const meantToPlay =
    several &&
    (choice === "playing" || (choice === "auto" && autoplay && !reducedMotion));
  // It rests while a mouse is over the banner, and while keyboard focus is in
  // it, until someone presses play.
  const playing = meantToPlay && !hovering && !(choice === "auto" && focusInside);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    // Start or stop the timer. This also runs after a swipe, which stops it.
    const sync = () => {
      const timer = emblaApi.plugins().autoplay;
      if (!timer) return;
      if (playing) timer.play();
      else timer.stop();
    };
    sync();
    emblaApi.on("reInit", sync).on("pointerUp", sync);
    return () => {
      emblaApi.off("reInit", sync).off("pointerUp", sync);
    };
  }, [emblaApi, playing]);

  const controls = {
    several,
    current: Math.min(selected, Math.max(slideCount - 1, 0)),
    playing,
    meantToPlay,
    prev: () => emblaApi?.scrollPrev(),
    next: () => emblaApi?.scrollNext(),
    goTo: (index: number) => emblaApi?.scrollTo(index),
    togglePlay: () => setChoice(meantToPlay ? "paused" : "playing"),
    // Spread these on the banner's outer box.
    handlers: {
      onPointerEnter: (e: PointerEvent) => {
        if (e.pointerType === "mouse") setHovering(true);
      },
      onPointerLeave: (e: PointerEvent) => {
        if (e.pointerType === "mouse") setHovering(false);
      },
      onFocus: () => setFocusInside(true),
      onBlur: (e: FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocusInside(false);
        }
      },
    },
  };
  // The ref goes on the photo strip; React wants it kept apart from the rest.
  return [emblaRef, controls] as const;
}

type Carousel = ReturnType<typeof useBannerCarousel>[1];
type CarouselRef = ReturnType<typeof useBannerCarousel>[0];

/** A link that opens other sites in a new tab, or only reports in the preview. */
function BannerLink({
  link,
  className,
  children,
  onLinkClick,
}: {
  link: ResolvedLink;
  className?: string;
  children: ReactNode;
  onLinkClick?: (href: string) => void;
}) {
  if (onLinkClick) {
    return (
      <a
        href={link.href}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onLinkClick(link.href);
        }}
      >
        {children}
      </a>
    );
  }
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {children}
    </Link>
  );
}

/** Previous, a dot for each photo, next, and pause or play. */
function SlideControls({ carousel, count }: { carousel: Carousel; count: number }) {
  const round =
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
  return (
    <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1 py-0.5 text-white backdrop-blur-sm">
      <button type="button" className={round} onClick={carousel.prev} aria-label="Previous photo">
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => carousel.goTo(i)}
          aria-label={`Show photo ${i + 1} of ${count}`}
          aria-current={i === carousel.current ? "true" : undefined}
          className="group inline-flex h-6 w-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span
            className={cn(
              "block h-2 rounded-full transition-all",
              i === carousel.current ? "w-3 bg-white" : "w-2 bg-white/50 group-hover:bg-white/80"
            )}
          />
        </button>
      ))}
      <button type="button" className={round} onClick={carousel.next} aria-label="Next photo">
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={round}
        onClick={carousel.togglePlay}
        aria-label={carousel.meantToPlay ? "Pause the slide show" : "Play the slide show"}
        title={carousel.meantToPlay ? "Pause" : "Play"}
      >
        {carousel.meantToPlay ? (
          <Pause size={16} aria-hidden="true" />
        ) : (
          <Play size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** The photos themselves. Fills the box it is placed in. */
function SlideTrack({
  banner,
  emblaRef,
  carousel,
  sizes,
  preview,
  onLinkClick,
}: {
  banner: ResolvedBanner;
  emblaRef: CarouselRef;
  carousel: Carousel;
  sizes: string;
  preview: boolean;
  onLinkClick?: (href: string) => void;
}) {
  const count = banner.slides.length;
  return (
    <div ref={emblaRef} className="h-full overflow-hidden">
      <div
        className="flex h-full touch-pan-y"
        // Screen readers announce a new photo only when the slide show is
        // still, so they aren't talked over every few seconds.
        aria-live={carousel.playing ? "off" : "polite"}
      >
        {banner.slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            // Photos out of view can't be tabbed into.
            inert={carousel.several && i !== carousel.current}
            className="relative h-full min-w-0 shrink-0 grow-0 basis-full"
          >
            <Image
              src={slide.url}
              alt={slide.alt}
              fill
              sizes={sizes}
              preload={i === 0 && !preview}
              className="object-cover"
            />
            {(slide.caption || slide.productLink) && (
              <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-2 rounded-lg bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
                {slide.caption && <span>{slide.caption}</span>}
                {slide.productLink && (
                  <BannerLink
                    link={slide.productLink}
                    onLinkClick={onLinkClick}
                    className="inline-flex items-center gap-1 rounded font-semibold text-brand-gold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {slide.productLink.label}
                    <ArrowRight size={14} aria-hidden="true" />
                  </BannerLink>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Headline, message, button and the "Next event" card. */
function BannerWords({
  banner,
  overPhotos,
  onLinkClick,
}: {
  banner: ResolvedBanner;
  overPhotos: boolean;
  onLinkClick?: (href: string) => void;
}) {
  const { style, link, event } = banner;
  const theme = THEME_CLASSES[style.theme];
  const center = style.textAlign === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        center ? "items-center text-center" : "items-start text-left"
      )}
    >
      {banner.headline && (
        <h2
          className={cn(
            "text-3xl font-bold leading-tight @3xl:text-4xl",
            style.headlineFont === "display" ? "font-display" : "font-sans",
            overPhotos ? "text-brand-cream" : theme.headline
          )}
        >
          {banner.headline}
        </h2>
      )}
      {banner.message && (
        <p
          className={cn(
            "max-w-prose whitespace-pre-line text-base leading-relaxed @3xl:text-lg",
            overPhotos ? "text-brand-cream/90" : theme.message
          )}
        >
          {banner.message}
        </p>
      )}
      {link && (
        <BannerLink
          link={link}
          onLinkClick={onLinkClick}
          className={cn(
            "pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-3 font-semibold transition-all motion-safe:hover:scale-105",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            theme.button,
            theme.ring
          )}
        >
          {link.label}
          <ArrowRight size={18} aria-hidden="true" />
        </BannerLink>
      )}
      {event && (
        <div
          className={cn(
            "pointer-events-auto w-full max-w-sm rounded-xl border p-4 text-left text-sm",
            overPhotos
              ? "border-white/15 bg-black/45 text-brand-cream backdrop-blur-sm"
              : theme.eventCard
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {event.heading}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{event.name}</h3>
          <ul className="mt-2 space-y-1 opacity-90">
            <li className="flex items-center gap-2">
              <Calendar size={14} aria-hidden="true" className="shrink-0" />
              {event.when}
            </li>
            {event.time && (
              <li className="flex items-center gap-2">
                <Clock size={14} aria-hidden="true" className="shrink-0" />
                {event.time}
              </li>
            )}
            {event.location && (
              <li className="flex items-center gap-2">
                <MapPin size={14} aria-hidden="true" className="shrink-0" />
                {event.location}
              </li>
            )}
          </ul>
          <BannerLink
            link={{ href: event.href, label: "See details", external: false }}
            onLinkClick={onLinkClick}
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded py-1 font-semibold focus-visible:outline-none focus-visible:ring-2",
              overPhotos ? "text-brand-gold hover:text-brand-cream focus-visible:ring-white" : theme.eventLink,
              !overPhotos && "focus-visible:ring-current"
            )}
          >
            See details
            <span className="sr-only"> for {event.name}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </BannerLink>
        </div>
      )}
    </div>
  );
}

export function HomeBannerView({ banner, onLinkClick }: HomeBannerViewProps) {
  const { style } = banner;
  const theme = THEME_CLASSES[style.theme];
  const count = banner.slides.length;
  const [emblaRef, carousel] = useBannerCarousel(count, style.autoplay, style.slideSeconds);
  const preview = Boolean(onLinkClick);
  const overPhotos = style.layout === "message_over" && count > 0;

  // The sliders reach the page as CSS variables (see .banner-glow in
  // src/app/globals.css).
  const variables = {
    "--banner-h": `${style.heightPx}px`,
    ...(style.glow && {
      "--glow-size": `${Math.round(8 + style.glow.strength * 0.4)}px`,
      "--glow-alpha": `${Math.round(25 + style.glow.strength * 0.6)}%`,
      "--glow-speed": `${style.glow.speedSeconds}s`,
    }),
  } as CSSProperties;

  let body: ReactNode;
  if (count === 0) {
    // No photos: just the words, in the middle.
    body = (
      <div className="mx-auto max-w-3xl px-6 py-10 @3xl:px-12 @3xl:py-14">
        <BannerWords banner={banner} overPhotos={false} onLinkClick={onLinkClick} />
      </div>
    );
  } else if (overPhotos) {
    const darkness = style.photoDarkness / 100;
    body = (
      <div className="relative flex min-h-[var(--banner-h)] flex-col">
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Photos"
          className="absolute inset-0"
        >
          <SlideTrack
            banner={banner}
            emblaRef={emblaRef}
            carousel={carousel}
            sizes="(max-width: 1280px) 100vw, 1280px"
            preview={preview}
            onLinkClick={onLinkClick}
          />
        </div>
        {/* Darkens the photos so the words stay easy to read. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,${darkness}), rgba(0,0,0,${darkness * 0.55}))`,
          }}
        />
        {/* Swipes pass through the words to the photos underneath. */}
        <div
          className={cn(
            "pointer-events-none relative flex flex-1 flex-col justify-end gap-6 px-6 pb-5 pt-16 @3xl:px-12 @3xl:pb-8",
            style.textAlign === "center" ? "items-center" : "items-stretch"
          )}
        >
          <BannerWords banner={banner} overPhotos onLinkClick={onLinkClick} />
          {carousel.several && (
            <div className="self-end">
              <SlideControls carousel={carousel} count={count} />
            </div>
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="grid @3xl:min-h-[var(--banner-h)] @3xl:grid-cols-2">
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Photos"
          className={cn(
            "relative aspect-[4/3] @3xl:aspect-auto",
            style.layout === "slides_right" && "@3xl:order-2"
          )}
        >
          <div className="absolute inset-0">
            <SlideTrack
              banner={banner}
              emblaRef={emblaRef}
              carousel={carousel}
              sizes="(max-width: 768px) 100vw, 640px"
              preview={preview}
              onLinkClick={onLinkClick}
            />
          </div>
          {carousel.several && (
            <div className="absolute bottom-3 right-3">
              <SlideControls carousel={carousel} count={count} />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center px-6 py-8 @3xl:px-10 @3xl:py-10">
          <BannerWords banner={banner} overPhotos={false} onLinkClick={onLinkClick} />
        </div>
      </div>
    );
  }

  return (
    <section aria-label="News from Big Sexy's" className="@container" style={variables}>
      <div
        className={cn("rounded-2xl", style.glow && "banner-glow")}
        data-glow={style.glow?.color}
        {...carousel.handlers}
      >
        <div className={cn("relative overflow-hidden rounded-2xl", theme.box)}>{body}</div>
      </div>
    </section>
  );
}
