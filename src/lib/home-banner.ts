import { z } from "zod";

/**
 * The home page banner: one row of settings in the home_banner table, plus up
 * to 10 photos in home_banner_slides. Admins edit both at /admin/banner.
 *
 * This file is safe to use in the browser. It holds the types, the input
 * checks, the color themes, and the steps that turn saved settings into what
 * the banner shows. The admin preview and the home page both use it, so they
 * always agree.
 */

export const MAX_SLIDES = 10;

export type BannerLinkType = "none" | "product" | "event" | "url";
export type BannerTheme = "night" | "ember" | "cream" | "pickle" | "barrel";
export type BannerLayout = "slides_left" | "slides_right" | "message_over";
export type BannerTextAlign = "left" | "center";
export type BannerHeadlineFont = "display" | "body";
export type BannerGlowColor = "orange" | "gold" | "orange_gold";
export type BannerEventMode = "auto" | "pick";

/** Every setting in the home_banner row except its id and updated_at. */
export interface HomeBannerSettings {
  enabled: boolean;
  /** When the banner starts showing (ISO date and time), or null for now. */
  starts_at: string | null;
  /** When the banner stops showing (ISO date and time), or null for never. */
  ends_at: string | null;
  headline: string;
  message: string;
  link_type: BannerLinkType;
  link_product_id: number | null;
  link_event_id: number | null;
  /** A page on this site ("/products") or a full https:// address. */
  link_url: string;
  link_label: string;
  event_section_enabled: boolean;
  event_section_mode: BannerEventMode;
  event_section_event_id: number | null;
  event_section_heading: string;
  theme: BannerTheme;
  layout: BannerLayout;
  text_align: BannerTextAlign;
  headline_font: BannerHeadlineFont;
  glow_enabled: boolean;
  glow_color: BannerGlowColor;
  /** 0 (faint) to 100 (strong). */
  glow_strength: number;
  /** Seconds for one slow pulse of the glow, 2 to 15. */
  glow_speed_seconds: number;
  autoplay: boolean;
  /** Seconds each photo stays up, 3 to 15. */
  slide_seconds: number;
  /** Banner height on computers, in pixels, 200 to 560. */
  height_px: number;
  /** How much the photos darken behind the words (message_over only), 0 to 80. */
  photo_darkness: number;
}

/** The columns to read from home_banner, in the same order as above. */
export const HOME_BANNER_COLUMNS =
  "enabled, starts_at, ends_at, headline, message, link_type, link_product_id, link_event_id, link_url, link_label, event_section_enabled, event_section_mode, event_section_event_id, event_section_heading, theme, layout, text_align, headline_font, glow_enabled, glow_color, glow_strength, glow_speed_seconds, autoplay, slide_seconds, height_px, photo_darkness";

/** The event columns the banner needs. */
export const BANNER_EVENT_COLUMNS =
  "id, name, date, end_date, is_recurring, recurrence_day, time, location";

/** One banner photo, as saved in home_banner_slides. */
export interface HomeBannerSlide {
  id: number;
  url: string;
  alt: string;
  caption: string;
  link_product_id: number | null;
  sort_order: number;
}

export interface BannerProduct {
  id: number;
  name: string;
  slug: string;
}

export interface BannerEvent {
  id: number;
  name: string;
  /** Date only, like "2026-10-25". */
  date: string;
  end_date?: string | null;
  is_recurring?: boolean;
  recurrence_day?: string | null;
  time: string;
  location: string;
}

/** The saved banner with its linked products and events filled in. */
export interface HomeBannerData {
  settings: HomeBannerSettings;
  slides: (HomeBannerSlide & { product: BannerProduct | null })[];
  linkProduct: BannerProduct | null;
  linkEvent: BannerEvent | null;
  pickedEvent: BannerEvent | null;
}

export interface ResolvedLink {
  href: string;
  label: string;
  /** True for addresses on other sites, which open in a new tab. */
  external: boolean;
}

export interface ResolvedEventCard {
  heading: string;
  name: string;
  when: string;
  time: string;
  location: string;
  href: string;
}

export interface ResolvedSlide {
  id: number;
  url: string;
  alt: string;
  caption: string;
  productLink: ResolvedLink | null;
}

export interface ResolvedBannerStyle {
  theme: BannerTheme;
  layout: BannerLayout;
  textAlign: BannerTextAlign;
  headlineFont: BannerHeadlineFont;
  /** Null when the glow is off. */
  glow: { color: BannerGlowColor; strength: number; speedSeconds: number } | null;
  autoplay: boolean;
  slideSeconds: number;
  heightPx: number;
  photoDarkness: number;
}

/** Everything the banner needs to draw itself. */
export interface ResolvedBanner {
  headline: string;
  message: string;
  link: ResolvedLink | null;
  event: ResolvedEventCard | null;
  slides: ResolvedSlide[];
  style: ResolvedBannerStyle;
}

// Choices for the admin dropdowns, with plain-English labels.

export const BANNER_THEMES: { value: BannerTheme; label: string }[] = [
  { value: "night", label: "Night (matches the site)" },
  { value: "ember", label: "Ember (orange to gold)" },
  { value: "cream", label: "Cream" },
  { value: "pickle", label: "Pickle green" },
  { value: "barrel", label: "Barrel brown and gold" },
];

export const BANNER_LAYOUTS: { value: BannerLayout; label: string }[] = [
  { value: "slides_left", label: "Photos on the left" },
  { value: "slides_right", label: "Photos on the right" },
  { value: "message_over", label: "Words on top of the photos" },
];

export const BANNER_TEXT_ALIGNS: { value: BannerTextAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
];

export const BANNER_HEADLINE_FONTS: { value: BannerHeadlineFont; label: string }[] = [
  { value: "display", label: "Headline font (like the site's titles)" },
  { value: "body", label: "Plain font (like the site's text)" },
];

export const GLOW_COLORS: { value: BannerGlowColor; label: string }[] = [
  { value: "orange_gold", label: "Orange and gold" },
  { value: "orange", label: "Orange" },
  { value: "gold", label: "Gold" },
];

export const LINK_TYPES: { value: BannerLinkType; label: string }[] = [
  { value: "none", label: "No button" },
  { value: "product", label: "A product" },
  { value: "event", label: "An event" },
  { value: "url", label: "A web address" },
];

/** The style settings "Reset style to default" puts back. */
export const DEFAULT_BANNER_STYLE = {
  theme: "night",
  layout: "slides_left",
  text_align: "left",
  headline_font: "display",
  glow_enabled: true,
  glow_color: "orange_gold",
  glow_strength: 50,
  glow_speed_seconds: 6,
  autoplay: true,
  slide_seconds: 6,
  height_px: 360,
  photo_darkness: 50,
} satisfies Partial<HomeBannerSettings>;

/**
 * Tailwind classes for each color theme. They are written out in full
 * because Tailwind only finds class names it can read whole in the code.
 */
export const THEME_CLASSES: Record<
  BannerTheme,
  {
    box: string;
    headline: string;
    message: string;
    button: string;
    eventCard: string;
    eventLink: string;
    ring: string;
  }
> = {
  night: {
    box: "bg-brand-black border border-brand-brown/40",
    headline: "text-brand-cream",
    message: "text-brand-cream/70",
    button: "bg-brand-orange text-white hover:bg-brand-orange/90",
    eventCard: "bg-white/5 border-brand-brown/50 text-brand-cream",
    eventLink: "text-brand-gold hover:text-brand-orange",
    ring: "focus-visible:ring-brand-orange focus-visible:ring-offset-brand-black",
  },
  ember: {
    box: "bg-gradient-to-br from-brand-orange to-brand-gold",
    headline: "text-brand-black",
    message: "text-brand-black/80",
    button: "bg-brand-black text-brand-cream hover:bg-brand-black/85",
    eventCard: "bg-brand-black/10 border-brand-black/20 text-brand-black",
    eventLink: "text-brand-black underline hover:no-underline",
    ring: "focus-visible:ring-brand-black focus-visible:ring-offset-brand-orange",
  },
  cream: {
    box: "bg-brand-cream border border-brand-brown/20",
    headline: "text-brand-black",
    message: "text-brand-brown",
    button: "bg-brand-orange text-white hover:bg-brand-orange/90",
    eventCard: "bg-brand-brown/5 border-brand-brown/20 text-brand-black",
    eventLink: "text-brand-brown underline hover:text-brand-orange",
    ring: "focus-visible:ring-brand-orange focus-visible:ring-offset-brand-cream",
  },
  pickle: {
    box: "bg-brand-green",
    headline: "text-brand-cream",
    message: "text-brand-cream/85",
    button: "bg-brand-cream text-brand-black hover:bg-brand-cream/90",
    eventCard: "bg-brand-black/15 border-brand-cream/20 text-brand-cream",
    eventLink: "text-brand-cream underline hover:no-underline",
    ring: "focus-visible:ring-brand-cream focus-visible:ring-offset-brand-green",
  },
  barrel: {
    box: "bg-brand-brown border border-brand-gold/30",
    headline: "text-brand-cream",
    message: "text-brand-cream/75",
    button: "bg-brand-gold text-brand-black hover:bg-brand-gold/90",
    eventCard: "bg-black/20 border-brand-gold/25 text-brand-cream",
    eventLink: "text-brand-gold hover:text-brand-cream",
    ring: "focus-visible:ring-brand-gold focus-visible:ring-offset-brand-brown",
  },
};

// Events

/**
 * True while an event still shows under "Upcoming Events" on the Find Us
 * page. This is the same rule getUpcomingEvents() in src/lib/data.ts uses,
 * so a banner link never points at an event card that has moved to "Past".
 */
export function isEventUpcoming(
  event: Pick<BannerEvent, "date" | "end_date">,
  now: Date
): boolean {
  return new Date(event.end_date ?? event.date) >= now;
}

/** The next upcoming event: the soonest start date, for "Automatic" mode. */
export function pickNextEvent<T extends BannerEvent>(events: T[], now: Date): T | null {
  const upcoming = events
    .filter((e) => isEventUpcoming(e, now))
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

/**
 * "Sat, Oct 25" for a date-only string. The date is read as UTC and shown in
 * UTC, so the server and the browser always print the same day.
 */
function formatDay(date: string, withWeekday = true): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: withWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
  });
}

/** The event's dates in words, like "Sat, Oct 25" or "Every Saturday through Nov 22". */
export function formatEventWhen(event: BannerEvent): string {
  if (event.is_recurring && event.recurrence_day && event.end_date) {
    return `Every ${event.recurrence_day} through ${formatDay(event.end_date, false)}`;
  }
  if (event.end_date && event.end_date !== event.date) {
    return `${formatDay(event.date)} to ${formatDay(event.end_date)}`;
  }
  return formatDay(event.date);
}

/** How an event reads in the admin dropdowns: "Sat, Oct 25: Golden Farmers Market". */
export function eventOptionLabel(event: BannerEvent, over: boolean): string {
  return `${formatEventWhen(event)}: ${event.name}${over ? " (over)" : ""}`;
}

/** The Find Us page, scrolled to one event's card. */
export function eventHref(eventId: number): string {
  return `/events#event-${eventId}`;
}

// Links

const URL_PATTERN = /^(\/[^/\s][^\s]*|https:\/\/[^\s]+)$/;

/**
 * Turn the main button choice into a web address. Returns null when there is
 * no button, the product or event is gone, or the event is over.
 */
export function resolveBannerLink(
  settings: Pick<
    HomeBannerSettings,
    "link_type" | "link_url" | "link_label"
  >,
  linkProduct: BannerProduct | null,
  linkEvent: BannerEvent | null,
  now: Date
): ResolvedLink | null {
  const label = settings.link_label.trim() || "Check it out";
  switch (settings.link_type) {
    case "product":
      return linkProduct
        ? { href: `/products/${linkProduct.slug}`, label, external: false }
        : null;
    case "event":
      return linkEvent && isEventUpcoming(linkEvent, now)
        ? { href: eventHref(linkEvent.id), label, external: false }
        : null;
    case "url": {
      const url = settings.link_url.trim();
      if (!URL_PATTERN.test(url)) return null;
      return { href: url, label, external: url.startsWith("https://") };
    }
    default:
      return null;
  }
}

// When the banner shows

/** True when now is inside the start and stop times (either may be empty). */
export function isInsideDates(
  settings: Pick<HomeBannerSettings, "starts_at" | "ends_at">,
  now: Date
): boolean {
  if (settings.starts_at && new Date(settings.starts_at) > now) return false;
  if (settings.ends_at && new Date(settings.ends_at) <= now) return false;
  return true;
}

/** True when the banner has something to show: words or at least one photo. */
export function hasBannerContent(
  settings: Pick<HomeBannerSettings, "headline" | "message">,
  slideCount: number
): boolean {
  return (
    settings.headline.trim() !== "" ||
    settings.message.trim() !== "" ||
    slideCount > 0
  );
}

/** True when the home page should show the banner right now. */
export function isBannerShowing(
  settings: HomeBannerSettings,
  slideCount: number,
  now: Date
): boolean {
  return (
    settings.enabled &&
    isInsideDates(settings, now) &&
    hasBannerContent(settings, slideCount)
  );
}

/**
 * Work out everything the banner shows. nextEvent is the next upcoming event,
 * used when the "Next event" section is set to Automatic. It is found when the
 * page loads, so the card moves on by itself once an event has passed.
 */
export function resolveBanner(
  data: HomeBannerData,
  options: { now: Date; nextEvent: BannerEvent | null }
): ResolvedBanner {
  const { settings } = data;
  const { now } = options;

  let event: ResolvedEventCard | null = null;
  if (settings.event_section_enabled) {
    const chosen =
      settings.event_section_mode === "auto" ? options.nextEvent : data.pickedEvent;
    if (chosen && isEventUpcoming(chosen, now)) {
      event = {
        heading: settings.event_section_heading.trim() || "Catch us next",
        name: chosen.name,
        when: formatEventWhen(chosen),
        time: chosen.time,
        location: chosen.location,
        href: eventHref(chosen.id),
      };
    }
  }

  return {
    headline: settings.headline.trim(),
    message: settings.message.trim(),
    link: resolveBannerLink(settings, data.linkProduct, data.linkEvent, now),
    event,
    slides: data.slides.map((slide) => ({
      id: slide.id,
      url: slide.url,
      alt: slide.alt,
      caption: slide.caption.trim(),
      productLink: slide.product
        ? {
            href: `/products/${slide.product.slug}`,
            label: `Shop ${slide.product.name}`,
            external: false,
          }
        : null,
    })),
    style: {
      theme: settings.theme,
      layout: settings.layout,
      textAlign: settings.text_align,
      headlineFont: settings.headline_font,
      glow: settings.glow_enabled
        ? {
            color: settings.glow_color,
            strength: settings.glow_strength,
            speedSeconds: settings.glow_speed_seconds,
          }
        : null,
      autoplay: settings.autoplay,
      slideSeconds: settings.slide_seconds,
      heightPx: settings.height_px,
      photoDarkness: settings.photo_darkness,
    },
  };
}

// Input checks

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label}: pick a number.` })
    .int(`${label}: use a whole number.`)
    .min(min, `${label} can't be less than ${min}.`)
    .max(max, `${label} can't be more than ${max}.`);

const id = z.number().int().positive().nullable();

const dateTime = (label: string) =>
  z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), `${label}: that isn't a date and time.`)
    .nullable();

export const homeBannerSchema = z
  .object({
    enabled: z.boolean(),
    starts_at: dateTime("Start"),
    ends_at: dateTime("Stop"),
    headline: z.string().trim().max(80, "The headline can be 80 characters at most."),
    message: z.string().trim().max(300, "The message can be 300 characters at most."),
    link_type: z.enum(["none", "product", "event", "url"], {
      error: "Pick where the button goes.",
    }),
    link_product_id: id,
    link_event_id: id,
    link_url: z.string().trim().max(500, "That web address is too long."),
    link_label: z.string().trim().max(30, "The button text can be 30 characters at most."),
    event_section_enabled: z.boolean(),
    event_section_mode: z.enum(["auto", "pick"], {
      error: "Pick which event to show.",
    }),
    event_section_event_id: id,
    event_section_heading: z
      .string()
      .trim()
      .max(40, "The event heading can be 40 characters at most."),
    theme: z.enum(["night", "ember", "cream", "pickle", "barrel"], {
      error: "Pick a color theme.",
    }),
    layout: z.enum(["slides_left", "slides_right", "message_over"], {
      error: "Pick a layout.",
    }),
    text_align: z.enum(["left", "center"], { error: "Pick a text alignment." }),
    headline_font: z.enum(["display", "body"], { error: "Pick a headline font." }),
    glow_enabled: z.boolean(),
    glow_color: z.enum(["orange", "gold", "orange_gold"], {
      error: "Pick a glow color.",
    }),
    glow_strength: wholeNumber("Glow strength", 0, 100),
    glow_speed_seconds: wholeNumber("Glow speed", 2, 15),
    autoplay: z.boolean(),
    slide_seconds: wholeNumber("Seconds per photo", 3, 15),
    height_px: wholeNumber("Banner height", 200, 560),
    photo_darkness: wholeNumber("Photo darkness", 0, 80),
  })
  .strict()
  .superRefine((s, ctx) => {
    const problem = (message: string, path: string) =>
      ctx.addIssue({ code: "custom", message, path: [path] });

    if (s.link_type !== "none" && s.link_label === "") {
      problem("Type the words for the button, like \"Shop now\".", "link_label");
    }
    if (s.link_type === "product" && s.link_product_id === null) {
      problem("Pick the product the button goes to.", "link_product_id");
    }
    if (s.link_type === "event" && s.link_event_id === null) {
      problem("Pick the event the button goes to.", "link_event_id");
    }
    if (s.link_type === "url" && !URL_PATTERN.test(s.link_url)) {
      problem(
        "The web address must start with / for a page on this site (like /products) or https:// for another site, with no spaces.",
        "link_url"
      );
    }
    if (s.event_section_mode === "pick" && s.event_section_event_id === null) {
      problem("Pick the event for the \"Next event\" section, or choose Automatic.", "event_section_event_id");
    }
    if (s.starts_at && s.ends_at && Date.parse(s.ends_at) <= Date.parse(s.starts_at)) {
      problem("The stop time must be after the start time.", "ends_at");
    }
  });

/**
 * A banner can't be switched on with nothing in it. Returns the problem in
 * plain words, or null when it's fine. The photo count lives in its own
 * table, so this sits outside homeBannerSchema.
 */
export function bannerReadyProblem(
  settings: Pick<HomeBannerSettings, "enabled" | "headline" | "message">,
  slideCount: number
): string | null {
  if (settings.enabled && !hasBannerContent(settings, slideCount)) {
    return "Add a headline, a message or a photo before switching the banner on.";
  }
  return null;
}

/** Clear the link choices that aren't in use, so old ones don't linger. */
export function tidyBannerSettings(s: HomeBannerSettings): HomeBannerSettings {
  return {
    ...s,
    link_product_id: s.link_type === "product" ? s.link_product_id : null,
    link_event_id: s.link_type === "event" ? s.link_event_id : null,
    link_url: s.link_type === "url" ? s.link_url : "",
    event_section_event_id:
      s.event_section_mode === "pick" ? s.event_section_event_id : null,
  };
}

export const slideSchema = z
  .object({
    alt: z
      .string()
      .trim()
      .min(1, "Describe the photo in a few words, for people who can't see it.")
      .max(200, "The photo description can be 200 characters at most."),
    caption: z.string().trim().max(80, "The caption can be 80 characters at most."),
    link_product_id: id,
  })
  .strict();

export type SlideInput = z.infer<typeof slideSchema>;
