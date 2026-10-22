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
export type BannerBorderStyle = "theme" | "none" | "thin" | "thick";
export type BannerButtonShape = "pill" | "rounded" | "square";
export type BannerButtonStyle = "filled" | "outline";
export type BannerCaptionPosition = "top_left" | "top_right" | "bottom_left" | "bottom_right";

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
  /** Seconds for one slow pulse of the glow, 0.5 to 15 in steps of 0.25. */
  glow_speed_seconds: number;
  autoplay: boolean;
  /** Seconds each photo stays up, 3 to 15. */
  slide_seconds: number;
  /** Banner height on computers, in pixels, 200 to 560. */
  height_px: number;
  /** How much the photos darken behind the words (message_over only), 0 to 80. */
  photo_darkness: number;
  // Custom colors, each a hex color like "#e8671c". Null uses the theme's color.
  bg_color: string | null;
  headline_color: string | null;
  message_color: string | null;
  button_color: string | null;
  button_text_color: string | null;
  event_bg_color: string | null;
  event_text_color: string | null;
  /** Replaces the glow_color choice when set. */
  glow_custom_color: string | null;
  /** The box behind a photo caption and behind the photo buttons. */
  caption_color: string | null;
  /** Null uses the glow color. */
  border_color: string | null;
  /** 0 (square) to 32 pixels. */
  corner_radius_px: number;
  /** "theme" keeps the theme's own edge. */
  border_style: BannerBorderStyle;
  /** 75 to 150 percent of the usual headline size, in steps of 5. */
  headline_size_pct: number;
  button_shape: BannerButtonShape;
  button_style: BannerButtonStyle;
  caption_position: BannerCaptionPosition;
}

/** The columns to read from home_banner, in the same order as above. */
export const HOME_BANNER_COLUMNS =
  "enabled, starts_at, ends_at, headline, message, link_type, link_product_id, link_event_id, link_url, link_label, event_section_enabled, event_section_mode, event_section_event_id, event_section_heading, theme, layout, text_align, headline_font, glow_enabled, glow_color, glow_strength, glow_speed_seconds, autoplay, slide_seconds, height_px, photo_darkness, bg_color, headline_color, message_color, button_color, button_text_color, event_bg_color, event_text_color, glow_custom_color, caption_color, border_color, corner_radius_px, border_style, headline_size_pct, button_shape, button_style, caption_position";

/**
 * Supabase sends NUMERIC columns as text ("1.25"), so turn the glow speed
 * back into a number when reading the row.
 */
export function readBannerRow<T extends { glow_speed_seconds: unknown }>(
  row: T
): Omit<T, "glow_speed_seconds"> & { glow_speed_seconds: number } {
  return { ...row, glow_speed_seconds: Number(row.glow_speed_seconds) };
}

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

/** The custom colors. Null means "use the theme's color". */
export interface BannerColors {
  background: string | null;
  headline: string | null;
  message: string | null;
  button: string | null;
  buttonText: string | null;
  eventBackground: string | null;
  eventText: string | null;
  caption: string | null;
}

export interface ResolvedBannerStyle {
  theme: BannerTheme;
  layout: BannerLayout;
  textAlign: BannerTextAlign;
  headlineFont: BannerHeadlineFont;
  /** Null when the glow is off. customColor, when set, replaces color. */
  glow: {
    color: BannerGlowColor;
    customColor: string | null;
    strength: number;
    speedSeconds: number;
  } | null;
  autoplay: boolean;
  slideSeconds: number;
  heightPx: number;
  photoDarkness: number;
  colors: BannerColors;
  cornerRadiusPx: number;
  /** Null keeps the theme's own edge (or none, with noBorder). */
  border: { widthPx: number; color: string } | null;
  noBorder: boolean;
  headlineScale: number;
  buttonShape: BannerButtonShape;
  buttonStyle: BannerButtonStyle;
  captionPosition: BannerCaptionPosition;
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

export const BANNER_BORDER_STYLES: { value: BannerBorderStyle; label: string }[] = [
  { value: "theme", label: "The theme's own" },
  { value: "none", label: "None" },
  { value: "thin", label: "Thin" },
  { value: "thick", label: "Thick" },
];

export const BANNER_BUTTON_SHAPES: { value: BannerButtonShape; label: string }[] = [
  { value: "pill", label: "Pill (round ends)" },
  { value: "rounded", label: "Rounded corners" },
  { value: "square", label: "Square corners" },
];

export const BANNER_BUTTON_STYLES: { value: BannerButtonStyle; label: string }[] = [
  { value: "filled", label: "Filled" },
  { value: "outline", label: "Outline only" },
];

export const BANNER_CAPTION_POSITIONS: { value: BannerCaptionPosition; label: string }[] = [
  { value: "top_left", label: "Top left" },
  { value: "top_right", label: "Top right" },
  { value: "bottom_left", label: "Bottom left" },
  { value: "bottom_right", label: "Bottom right" },
];

/** Border widths in pixels. */
const BORDER_WIDTHS = { thin: 1, thick: 3 } as const;

/** The brand colors from src/app/globals.css, plus white and a dark gray. */
export const BRAND_SWATCHES: { name: string; hex: string }[] = [
  { name: "Orange", hex: "#e8671c" },
  { name: "Gold", hex: "#d4a017" },
  { name: "Cream", hex: "#f5e6c8" },
  { name: "Brown", hex: "#3d2b1f" },
  { name: "Black", hex: "#1a1a1a" },
  { name: "Green", hex: "#6b7b3a" },
  { name: "White", hex: "#ffffff" },
  { name: "Dark gray", hex: "#404040" },
];

/** The glow color choices as hex colors. A border uses orange for "Orange and gold". */
export const GLOW_HEX: Record<BannerGlowColor, string> = {
  orange: "#e8671c",
  gold: "#d4a017",
  orange_gold: "#e8671c",
};

/** A hex color like "#e8671c", the only kind the color columns hold. */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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
  bg_color: null,
  headline_color: null,
  message_color: null,
  button_color: null,
  button_text_color: null,
  event_bg_color: null,
  event_text_color: null,
  glow_custom_color: null,
  caption_color: null,
  border_color: null,
  corner_radius_px: 18,
  border_style: "theme",
  headline_size_pct: 100,
  button_shape: "pill",
  button_style: "filled",
  caption_position: "top_left",
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

/**
 * Each theme's main colors as hex values. The admin color pickers start from
 * these, and an outline button uses the theme's button color for its edge
 * and words. See-through colors are written as the solid color they make.
 */
export const THEME_COLORS: Record<
  BannerTheme,
  {
    background: string;
    headline: string;
    message: string;
    button: string;
    buttonText: string;
    eventBackground: string;
    eventText: string;
  }
> = {
  night: {
    background: "#1a1a1a",
    headline: "#f5e6c8",
    message: "#b3a994",
    button: "#e8671c",
    buttonText: "#ffffff",
    eventBackground: "#262626",
    eventText: "#f5e6c8",
  },
  ember: {
    background: "#e8671c",
    headline: "#1a1a1a",
    message: "#43291a",
    button: "#1a1a1a",
    buttonText: "#f5e6c8",
    eventBackground: "#d35f1c",
    eventText: "#1a1a1a",
  },
  cream: {
    background: "#f5e6c8",
    headline: "#1a1a1a",
    message: "#3d2b1f",
    button: "#e8671c",
    buttonText: "#ffffff",
    eventBackground: "#ecddc0",
    eventText: "#1a1a1a",
  },
  pickle: {
    background: "#6b7b3a",
    headline: "#f5e6c8",
    message: "#e0d6b3",
    button: "#f5e6c8",
    buttonText: "#1a1a1a",
    eventBackground: "#5f6c35",
    eventText: "#f5e6c8",
  },
  barrel: {
    background: "#3d2b1f",
    headline: "#f5e6c8",
    message: "#c7b79e",
    button: "#d4a017",
    buttonText: "#1a1a1a",
    eventBackground: "#312219",
    eventText: "#f5e6c8",
  },
};

// Colors

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** How bright a hex color looks, from 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/**
 * How far apart two colors stand, from 1 (the same) to 21 (black on white).
 * Text needs at least 4.5 to be easy to read.
 */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** White or near black, whichever reads better on the given color. */
export function readableTextOn(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#1a1a1a") ? "#ffffff" : "#1a1a1a";
}

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
            customColor: settings.glow_custom_color,
            strength: settings.glow_strength,
            speedSeconds: settings.glow_speed_seconds,
          }
        : null,
      autoplay: settings.autoplay,
      slideSeconds: settings.slide_seconds,
      heightPx: settings.height_px,
      photoDarkness: settings.photo_darkness,
      colors: {
        background: settings.bg_color,
        headline: settings.headline_color,
        message: settings.message_color,
        button: settings.button_color,
        buttonText: settings.button_text_color,
        eventBackground: settings.event_bg_color,
        eventText: settings.event_text_color,
        caption: settings.caption_color,
      },
      cornerRadiusPx: settings.corner_radius_px,
      border:
        settings.border_style === "thin" || settings.border_style === "thick"
          ? {
              widthPx: BORDER_WIDTHS[settings.border_style],
              color:
                settings.border_color ??
                settings.glow_custom_color ??
                GLOW_HEX[settings.glow_color],
            }
          : null,
      noBorder: settings.border_style === "none",
      headlineScale: settings.headline_size_pct / 100,
      buttonShape: settings.button_shape,
      buttonStyle: settings.button_style,
      captionPosition: settings.caption_position,
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

const color = (label: string) =>
  z
    .string()
    .regex(HEX_COLOR, `${label}: pick a color, or press "Theme color".`)
    .nullable();

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
    glow_speed_seconds: z
      .number({ error: "Glow speed: pick a number." })
      .min(0.5, "Glow speed can't be less than 0.5 seconds.")
      .max(15, "Glow speed can't be more than 15 seconds.")
      .refine((v) => Number.isInteger(v * 4), "Glow speed goes in steps of 0.25 seconds."),
    autoplay: z.boolean(),
    slide_seconds: wholeNumber("Seconds per photo", 3, 15),
    height_px: wholeNumber("Banner height", 200, 560),
    photo_darkness: wholeNumber("Photo darkness", 0, 80),
    bg_color: color("Banner background"),
    headline_color: color("Headline color"),
    message_color: color("Message color"),
    button_color: color("Button color"),
    button_text_color: color("Button text color"),
    event_bg_color: color("Event card background"),
    event_text_color: color("Event card text"),
    glow_custom_color: color("Glow color"),
    caption_color: color("Caption color"),
    border_color: color("Border color"),
    corner_radius_px: wholeNumber("Corner roundness", 0, 32),
    border_style: z.enum(["theme", "none", "thin", "thick"], { error: "Pick a border." }),
    headline_size_pct: wholeNumber("Headline size", 75, 150).multipleOf(
      5,
      "Headline size goes in steps of 5%."
    ),
    button_shape: z.enum(["pill", "rounded", "square"], { error: "Pick a button shape." }),
    button_style: z.enum(["filled", "outline"], { error: "Pick a button style." }),
    caption_position: z.enum(["top_left", "top_right", "bottom_left", "bottom_right"], {
      error: "Pick where captions go.",
    }),
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
