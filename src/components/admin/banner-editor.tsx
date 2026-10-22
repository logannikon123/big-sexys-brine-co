"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AlertTriangle, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Range } from "@/components/ui/range";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HomeBannerView } from "@/components/home/HomeBannerView";
import { BannerSlidesManager } from "@/components/admin/banner-slides-manager";
import { updateHomeBanner } from "@/app/admin/banner/actions";
import {
  BANNER_BORDER_STYLES,
  BANNER_BUTTON_SHAPES,
  BANNER_BUTTON_STYLES,
  BANNER_CAPTION_POSITIONS,
  BANNER_HEADLINE_FONTS,
  BANNER_LAYOUTS,
  BANNER_TEXT_ALIGNS,
  BANNER_THEMES,
  BRAND_SWATCHES,
  DEFAULT_BANNER_STYLE,
  GLOW_COLORS,
  GLOW_HEX,
  LINK_TYPES,
  THEME_COLORS,
  bannerReadyProblem,
  contrastRatio,
  eventOptionLabel,
  hasBannerContent,
  homeBannerSchema,
  pickNextEvent,
  resolveBanner,
  type BannerEvent,
  type BannerProduct,
  type HomeBannerSettings,
  type HomeBannerSlide,
} from "@/lib/home-banner";

type EventChoice = BannerEvent & { over: boolean };

interface BannerEditorProps {
  initialSettings: HomeBannerSettings;
  initialSlides: HomeBannerSlide[];
  products: BannerProduct[];
  /** Upcoming events, plus any past event the banner still links to. */
  events: EventChoice[];
}

// Dates and times show in the browser's own time zone, which the server
// can't know. This is false while the server draws the page and true once
// the browser takes over, so those boxes fill in only in the browser.
const noSubscribe = () => () => {};
function useInBrowser() {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/** The time now, moving on once a minute so the status line stays right. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** An ISO time as the "2026-10-25T09:00" a datetime-local box wants. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** What a datetime-local box holds, as an ISO time, or null when empty. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "Oct 25 at 9:00 AM" in the browser's time zone. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}

function bannerStatus(settings: HomeBannerSettings, slideCount: number, now: Date) {
  if (!settings.enabled) return { live: false, text: "Off. Visitors don't see the banner." };
  if (!hasBannerContent(settings, slideCount)) {
    return { live: false, text: "On, but empty. Add a headline, a message or a photo." };
  }
  if (settings.starts_at && new Date(settings.starts_at) > now) {
    return { live: false, text: `Starts ${formatWhen(settings.starts_at)}.` };
  }
  if (settings.ends_at && new Date(settings.ends_at) <= now) {
    return { live: false, text: `Ended ${formatWhen(settings.ends_at)}.` };
  }
  return {
    live: true,
    text: settings.ends_at
      ? `Showing now, until ${formatWhen(settings.ends_at)}.`
      : "Showing now.",
  };
}

function Help({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-brand-gold/40 bg-brand-gold/10 p-2 text-xs text-brand-gold">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function SwitchRow({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

/** A text box with a "12 of 80" counter. */
function CountedField({
  id,
  label,
  value,
  max,
  onChange,
  multiline,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const Field = multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn(
            "text-xs tabular-nums",
            value.length > max ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {value.length} of {max}
        </span>
      </div>
      <Field
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
      />
    </div>
  );
}

/**
 * One custom color: quick brand swatches, the browser's own color picker for
 * any color, and a button that goes back to the theme's color (null).
 */
function ColorField({
  id,
  label,
  value,
  fallback,
  onChange,
  clearLabel = "Theme color",
  help,
}: {
  id: string;
  label: string;
  value: string | null;
  /** What the picker shows while no color is chosen. */
  fallback: string;
  onChange: (value: string | null) => void;
  clearLabel?: string;
  help?: ReactNode;
}) {
  const current = value?.toLowerCase() ?? null;
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="shrink-0 text-xs text-muted-foreground">{current ?? clearLabel}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label}: brand colors`}>
        {BRAND_SWATCHES.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            onClick={() => onChange(swatch.hex)}
            aria-pressed={current === swatch.hex}
            aria-label={swatch.name}
            title={swatch.name}
            className={cn(
              "h-6 w-6 rounded-full border border-white/25 shadow-sm transition-transform hover:scale-110",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              current === swatch.hex &&
                "ring-2 ring-brand-orange ring-offset-2 ring-offset-background"
            )}
            style={{ background: swatch.hex }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="color"
          value={current ?? fallback}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          title="Pick any color"
          className="h-8 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(null)}
          disabled={current === null}
        >
          {clearLabel}
        </Button>
      </div>
      {help}
    </div>
  );
}

/**
 * Text needs a contrast of at least 4.5 to 1 against its background to be
 * easy to read. Lists each pair of chosen colors that falls short. Only
 * pairs where both colors are chosen are checked.
 */
function contrastWarnings(s: HomeBannerSettings): string[] {
  const pairs: [string | null, string | null, string][] = [
    [s.headline_color, s.bg_color, "The headline color and the banner background"],
    [s.message_color, s.bg_color, "The message color and the banner background"],
    s.button_style === "outline"
      ? [s.button_color, s.bg_color, "The outline button color and the banner background"]
      : [s.button_text_color, s.button_color, "The button text and button colors"],
    [s.event_text_color, s.event_bg_color, "The event card text and background colors"],
  ];
  return pairs.flatMap(([text, background, what]) => {
    if (!text || !background) return [];
    const ratio = contrastRatio(text, background);
    return ratio < 4.5
      ? [
          `${what} are too close to read easily (${ratio.toFixed(1)} to 1). Aim for 4.5 to 1 or more.`,
        ]
      : [];
  });
}

/** "1.25 s per pulse". */
function formatPulse(seconds: number): string {
  return `${seconds} s per pulse`;
}

/**
 * Draws the banner at a real page width (a phone or a computer) and shrinks
 * the picture to fit the preview column, so it looks just as it will on the
 * site.
 */
function PreviewFrame({ width, children }: { width: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const scale = Math.min(1, outer.current.clientWidth / width);
      setSize({ scale, height: inner.current.offsetHeight * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (outer.current) observer.observe(outer.current);
    if (inner.current) observer.observe(inner.current);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outer} className="w-full overflow-hidden" style={{ height: size.height || undefined }}>
      <div
        ref={inner}
        style={{
          width,
          transform: `scale(${size.scale})`,
          transformOrigin: "top left",
          marginLeft: size.scale === 1 ? "auto" : undefined,
          marginRight: size.scale === 1 ? "auto" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function BannerEditor({
  initialSettings,
  initialSlides,
  products,
  events,
}: BannerEditorProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [slides, setSlides] = useState(initialSlides);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [device, setDevice] = useState<"phone" | "computer">("computer");
  const inBrowser = useInBrowser();
  const now = useNow();

  const unsaved = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const set = <K extends keyof HomeBannerSettings>(key: K, value: HomeBannerSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const linkedEvent =
    settings.link_event_id !== null ? eventById.get(settings.link_event_id) : undefined;
  const pickedEvent =
    settings.event_section_event_id !== null
      ? eventById.get(settings.event_section_event_id)
      : undefined;
  const nextEvent = pickNextEvent(events, now);

  // The preview uses the same steps as the home page, from what is typed now.
  const preview = resolveBanner(
    {
      settings,
      slides: slides.map((s) => ({
        ...s,
        product: s.link_product_id !== null ? productById.get(s.link_product_id) ?? null : null,
      })),
      linkProduct:
        settings.link_product_id !== null ? productById.get(settings.link_product_id) ?? null : null,
      linkEvent: linkedEvent ?? null,
      pickedEvent: pickedEvent ?? null,
    },
    { now, nextEvent }
  );
  const previewEmpty = !hasBannerContent(settings, slides.length);
  const themeColors = THEME_COLORS[settings.theme];
  const glowHex = settings.glow_custom_color ?? GLOW_HEX[settings.glow_color];
  const lowContrast = contrastWarnings(settings);
  const status = bannerStatus(settings, slides.length, now);

  const handleSave = async () => {
    const checked = homeBannerSchema.safeParse(settings);
    const messages = checked.success
      ? []
      : [...new Set(checked.error.issues.map((issue) => issue.message))];
    const notReady = bannerReadyProblem(settings, slides.length);
    if (notReady) messages.push(notReady);
    if (messages.length > 0) {
      setProblems(messages);
      toast.error(messages[0]);
      return;
    }

    setProblems([]);
    setSaving(true);
    try {
      const result = await updateHomeBanner(settings);
      if (result.error) {
        setProblems([result.error]);
        toast.error(result.error);
      } else {
        setSavedSettings(settings);
        toast.success("Banner saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the banner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Live preview: on top on phones, on the right on big screens.
          min-w-0 lets the column shrink below the 1280 px preview inside it. */}
      <div className="min-w-0 xl:order-2">
        <div className="space-y-3 xl:sticky xl:top-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Preview</h2>
            <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Preview size">
              {(
                [
                  { value: "phone", label: "Phone", Icon: Smartphone },
                  { value: "computer", label: "Computer", Icon: Monitor },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDevice(value)}
                  aria-pressed={device === value}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                    device === value
                      ? "bg-brand-orange/15 text-brand-orange"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-brand-black">
            {previewEmpty ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Add a headline, a message or a photo to see the banner here.
              </p>
            ) : (
              <PreviewFrame width={device === "phone" ? 375 : 1280}>
                <div className={device === "phone" ? "px-4 py-8" : "px-8 py-10"}>
                  <HomeBannerView
                    banner={preview}
                    onLinkClick={(href) => toast(`On the site this goes to ${href}`)}
                  />
                </div>
              </PreviewFrame>
            )}
          </div>
          <Help>
            The preview shows unsaved changes, and shows the banner even while
            it&apos;s off. Links don&apos;t leave this page.
          </Help>
        </div>
      </div>

      {/* The form */}
      <div className="min-w-0 space-y-6 xl:order-1">
        <Card>
          <CardHeader>
            <CardTitle>Show the banner</CardTitle>
            <CardDescription>
              The banner appears at the top of the home page while it&apos;s on.
              Start and stop times are optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SwitchRow
              id="banner_enabled"
              checked={settings.enabled}
              onChange={(v) => set("enabled", v)}
              label="Banner on"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="banner_starts">Start showing (optional)</Label>
                <Input
                  id="banner_starts"
                  type="datetime-local"
                  value={inBrowser ? toLocalInput(settings.starts_at) : ""}
                  onChange={(e) => set("starts_at", fromLocalInput(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner_ends">Stop showing (optional)</Label>
                <Input
                  id="banner_ends"
                  type="datetime-local"
                  value={inBrowser ? toLocalInput(settings.ends_at) : ""}
                  onChange={(e) => set("ends_at", fromLocalInput(e.target.value))}
                />
              </div>
            </div>
            {inBrowser && (
              <p
                className={cn(
                  "text-sm font-medium",
                  status.live ? "text-brand-green" : "text-muted-foreground"
                )}
              >
                {unsaved && "After you save: "}
                {status.text}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Message and button</CardTitle>
            <CardDescription>Plain text. Leave a box empty to leave it out.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CountedField
              id="banner_headline"
              label="Headline"
              value={settings.headline}
              max={80}
              onChange={(v) => set("headline", v)}
              placeholder="New flavor: Dill With It"
            />
            <CountedField
              id="banner_message"
              label="Message"
              value={settings.message}
              max={300}
              multiline
              onChange={(v) => set("message", v)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="banner_link_type">Button goes to</Label>
                <Select
                  id="banner_link_type"
                  value={settings.link_type}
                  onChange={(e) =>
                    set("link_type", e.target.value as HomeBannerSettings["link_type"])
                  }
                >
                  {LINK_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              {settings.link_type !== "none" && (
                <CountedField
                  id="banner_link_label"
                  label="Button text"
                  value={settings.link_label}
                  max={30}
                  onChange={(v) => set("link_label", v)}
                />
              )}
            </div>
            {settings.link_type === "product" && (
              <div className="space-y-2">
                <Label htmlFor="banner_link_product">Product</Label>
                <Select
                  id="banner_link_product"
                  value={settings.link_product_id ?? ""}
                  onChange={(e) =>
                    set("link_product_id", e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Pick a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {settings.link_type === "event" && (
              <div className="space-y-2">
                <Label htmlFor="banner_link_event">Event</Label>
                <Select
                  id="banner_link_event"
                  value={settings.link_event_id ?? ""}
                  onChange={(e) =>
                    set("link_event_id", e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Pick an event</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {eventOptionLabel(e, e.over)}
                    </option>
                  ))}
                </Select>
                <Help>The button opens that event on the Find Us page.</Help>
                {linkedEvent?.over && (
                  <Warning>That event is over, so the button is hidden. Pick another.</Warning>
                )}
              </div>
            )}
            {settings.link_type === "url" && (
              <div className="space-y-2">
                <Label htmlFor="banner_link_url">Web address</Label>
                <Input
                  id="banner_link_url"
                  value={settings.link_url}
                  maxLength={500}
                  placeholder="/products or https://www.instagram.com/bigsexysbrineco"
                  onChange={(e) => set("link_url", e.target.value)}
                />
                <Help>
                  Start with / for a page on this site, or https:// for another
                  site. Other sites open in a new tab.
                </Help>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next event</CardTitle>
            <CardDescription>
              A small card with an event&apos;s name, date, time and place, and a
              link to it on the Find Us page. It hides itself once the event is over.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SwitchRow
              id="banner_event_enabled"
              checked={settings.event_section_enabled}
              onChange={(v) => set("event_section_enabled", v)}
              label="Show the next event"
            />
            {settings.event_section_enabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="banner_event_mode">Which event</Label>
                    <Select
                      id="banner_event_mode"
                      value={settings.event_section_mode}
                      onChange={(e) =>
                        set(
                          "event_section_mode",
                          e.target.value as HomeBannerSettings["event_section_mode"]
                        )
                      }
                    >
                      <option value="auto">Automatic (the next upcoming event)</option>
                      <option value="pick">Pick one</option>
                    </Select>
                  </div>
                  <CountedField
                    id="banner_event_heading"
                    label="Heading"
                    value={settings.event_section_heading}
                    max={40}
                    onChange={(v) => set("event_section_heading", v)}
                    placeholder="Catch us next"
                  />
                </div>
                {settings.event_section_mode === "auto" ? (
                  <Help>
                    {nextEvent
                      ? `Showing now: ${eventOptionLabel(nextEvent, false)}. It moves on by itself after that event.`
                      : "No upcoming events, so the card is hidden until you add one."}
                  </Help>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="banner_event_pick">Event</Label>
                    <Select
                      id="banner_event_pick"
                      value={settings.event_section_event_id ?? ""}
                      onChange={(e) =>
                        set(
                          "event_section_event_id",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                    >
                      <option value="">Pick an event</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {eventOptionLabel(e, e.over)}
                        </option>
                      ))}
                    </Select>
                    {pickedEvent?.over && (
                      <Warning>That event is over, so the card is hidden. Pick another.</Warning>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>
              Up to 10. Each photo can link to a product with a small caption link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BannerSlidesManager slides={slides} onChange={setSlides} products={products} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Look and feel</CardTitle>
            <CardDescription>
              The first theme matches the rest of the site. People who ask their
              phone or computer for less motion see a still glow and no
              automatic slide show.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="banner_theme">Color theme</Label>
                <Select
                  id="banner_theme"
                  value={settings.theme}
                  onChange={(e) => set("theme", e.target.value as HomeBannerSettings["theme"])}
                >
                  {BANNER_THEMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner_layout">Layout</Label>
                <Select
                  id="banner_layout"
                  value={settings.layout}
                  onChange={(e) => set("layout", e.target.value as HomeBannerSettings["layout"])}
                >
                  {BANNER_LAYOUTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner_align">Text alignment</Label>
                <Select
                  id="banner_align"
                  value={settings.text_align}
                  onChange={(e) =>
                    set("text_align", e.target.value as HomeBannerSettings["text_align"])
                  }
                >
                  {BANNER_TEXT_ALIGNS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner_font">Headline font</Label>
                <Select
                  id="banner_font"
                  value={settings.headline_font}
                  onChange={(e) =>
                    set("headline_font", e.target.value as HomeBannerSettings["headline_font"])
                  }
                >
                  {BANNER_HEADLINE_FONTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner_button_shape">Button shape</Label>
                <Select
                  id="banner_button_shape"
                  value={settings.button_shape}
                  onChange={(e) =>
                    set("button_shape", e.target.value as HomeBannerSettings["button_shape"])
                  }
                >
                  {BANNER_BUTTON_SHAPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner_button_style">Button style</Label>
                <Select
                  id="banner_button_style"
                  value={settings.button_style}
                  onChange={(e) =>
                    set("button_style", e.target.value as HomeBannerSettings["button_style"])
                  }
                >
                  {BANNER_BUTTON_STYLES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner_caption_position">Photo caption position</Label>
                <Select
                  id="banner_caption_position"
                  value={settings.caption_position}
                  onChange={(e) =>
                    set(
                      "caption_position",
                      e.target.value as HomeBannerSettings["caption_position"]
                    )
                  }
                >
                  {BANNER_CAPTION_POSITIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {settings.layout === "message_over" &&
                  settings.caption_position.startsWith("bottom") && (
                    <Help>
                      With words on top of the photos, captions stay at the top
                      so the words don&apos;t cover them.
                    </Help>
                  )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner_border">Border</Label>
                <Select
                  id="banner_border"
                  value={settings.border_style}
                  onChange={(e) =>
                    set("border_style", e.target.value as HomeBannerSettings["border_style"])
                  }
                >
                  {BANNER_BORDER_STYLES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {(settings.border_style === "thin" || settings.border_style === "thick") && (
              <ColorField
                id="banner_border_color"
                label="Border color"
                value={settings.border_color}
                fallback={glowHex}
                onChange={(v) => set("border_color", v)}
                clearLabel="Glow color"
              />
            )}

            <div className="space-y-4 rounded-md border border-border p-4">
              <Range
                id="banner_corners"
                label="Corner roundness"
                value={settings.corner_radius_px}
                min={0}
                max={32}
                onChange={(v) => set("corner_radius_px", v)}
                format={(v) => (v === 0 ? "Square" : `${v} px`)}
              />
              <Range
                id="banner_headline_size"
                label="Headline size"
                value={settings.headline_size_pct}
                min={75}
                max={150}
                step={5}
                onChange={(v) => set("headline_size_pct", v)}
                format={(v) => `${v}%`}
                help="100% is the usual size."
              />
            </div>

            <div className="@container space-y-4 rounded-md border border-border p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Colors</h3>
                <Help>
                  Each one starts on the theme&apos;s color. Tap a brand color,
                  pick any color, or press &quot;Theme color&quot; to go back.
                </Help>
              </div>
              <div className="grid gap-5 @md:grid-cols-2">
                <ColorField
                  id="banner_bg_color"
                  label="Banner background"
                  value={settings.bg_color}
                  fallback={themeColors.background}
                  onChange={(v) => set("bg_color", v)}
                />
                <ColorField
                  id="banner_headline_color"
                  label="Headline"
                  value={settings.headline_color}
                  fallback={themeColors.headline}
                  onChange={(v) => set("headline_color", v)}
                />
                <ColorField
                  id="banner_message_color"
                  label="Message"
                  value={settings.message_color}
                  fallback={themeColors.message}
                  onChange={(v) => set("message_color", v)}
                />
                <ColorField
                  id="banner_button_color"
                  label={settings.button_style === "outline" ? "Button outline and words" : "Button"}
                  value={settings.button_color}
                  fallback={themeColors.button}
                  onChange={(v) => set("button_color", v)}
                />
                {settings.button_style === "filled" && (
                  <ColorField
                    id="banner_button_text_color"
                    label="Button words"
                    value={settings.button_text_color}
                    fallback={themeColors.buttonText}
                    onChange={(v) => set("button_text_color", v)}
                  />
                )}
                <ColorField
                  id="banner_event_bg_color"
                  label="Event card background"
                  value={settings.event_bg_color}
                  fallback={themeColors.eventBackground}
                  onChange={(v) => set("event_bg_color", v)}
                />
                <ColorField
                  id="banner_event_text_color"
                  label="Event card words"
                  value={settings.event_text_color}
                  fallback={themeColors.eventText}
                  onChange={(v) => set("event_text_color", v)}
                />
                <ColorField
                  id="banner_caption_color"
                  label="Photo caption and photo buttons"
                  value={settings.caption_color}
                  fallback="#000000"
                  onChange={(v) => set("caption_color", v)}
                  help={<Help>The words switch to white or black to stay readable.</Help>}
                />
              </div>
              {lowContrast.map((warning) => (
                <Warning key={warning}>{warning}</Warning>
              ))}
            </div>

            <div className="space-y-4 rounded-md border border-border p-4">
              <SwitchRow
                id="banner_glow"
                checked={settings.glow_enabled}
                onChange={(v) => set("glow_enabled", v)}
                label="Glow around the edge"
              />
              {settings.glow_enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="banner_glow_color">Glow color</Label>
                    <Select
                      id="banner_glow_color"
                      value={settings.glow_color}
                      disabled={settings.glow_custom_color !== null}
                      onChange={(e) =>
                        set("glow_color", e.target.value as HomeBannerSettings["glow_color"])
                      }
                    >
                      {GLOW_COLORS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <ColorField
                    id="banner_glow_custom_color"
                    label="Or any glow color"
                    value={settings.glow_custom_color}
                    fallback={GLOW_HEX[settings.glow_color]}
                    onChange={(v) => set("glow_custom_color", v)}
                    clearLabel="Use the choice above"
                  />
                  <Range
                    id="banner_glow_strength"
                    label="Glow strength"
                    value={settings.glow_strength}
                    min={0}
                    max={100}
                    onChange={(v) => set("glow_strength", v)}
                    format={(v) => `${v} of 100`}
                  />
                  <Range
                    id="banner_glow_speed"
                    label="Glow pulse speed"
                    value={settings.glow_speed_seconds}
                    min={0.5}
                    max={15}
                    step={0.25}
                    onChange={(v) => set("glow_speed_seconds", v)}
                    format={formatPulse}
                    help="Lower is faster."
                  />
                </>
              )}
            </div>

            <div className="space-y-4 rounded-md border border-border p-4">
              <SwitchRow
                id="banner_autoplay"
                checked={settings.autoplay}
                onChange={(v) => set("autoplay", v)}
                label="Slide show plays by itself"
              />
              <Range
                id="banner_slide_seconds"
                label="Each photo shows for"
                value={settings.slide_seconds}
                min={3}
                max={15}
                onChange={(v) => set("slide_seconds", v)}
                format={(v) => `${v} seconds`}
                disabled={!settings.autoplay}
              />
              <Range
                id="banner_height"
                label="Banner height on computers"
                value={settings.height_px}
                min={200}
                max={560}
                step={10}
                onChange={(v) => set("height_px", v)}
                format={(v) => `${v} pixels`}
                help="On phones the photos keep their shape and the words sit below them."
              />
              {settings.layout === "message_over" && (
                <Range
                  id="banner_darkness"
                  label="Photo darkness behind the words"
                  value={settings.photo_darkness}
                  min={0}
                  max={80}
                  step={5}
                  onChange={(v) => set("photo_darkness", v)}
                  format={(v) => `${v}%`}
                  help="Darker photos make the words easier to read."
                />
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setSettings((s) => ({ ...s, ...DEFAULT_BANNER_STYLE }))}
            >
              Reset style to default
            </Button>
          </CardContent>
        </Card>

        {problems.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Please fix these before saving:</p>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center gap-3 rounded-t-lg border-t border-border bg-background/95 px-2 py-3 backdrop-blur">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save banner"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {unsaved
              ? "You have unsaved changes. "
              : ""}
            Changes reach the live site within a minute. Photos save as you add them.
          </span>
        </div>
      </div>
    </div>
  );
}
