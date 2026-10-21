import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BannerEditor } from "@/components/admin/banner-editor";
import {
  BANNER_EVENT_COLUMNS,
  HOME_BANNER_COLUMNS,
  isEventUpcoming,
  type BannerEvent,
  type BannerProduct,
  type HomeBannerSettings,
  type HomeBannerSlide,
} from "@/lib/home-banner";

export default async function AdminBannerPage() {
  await requireAuth();
  const supabase = await createClient();
  const [
    { data: row, error: rowError },
    { data: slideRows, error: slideError },
    { data: productRows },
    { data: eventRows },
  ] = await Promise.all([
    supabase.from("home_banner").select(HOME_BANNER_COLUMNS).eq("id", 1).maybeSingle(),
    supabase
      .from("home_banner_slides")
      .select("id, url, alt, caption, link_product_id, sort_order")
      .order("sort_order")
      .order("id"),
    supabase.from("products").select("id, name, slug").order("sort_order"),
    supabase.from("events").select(BANNER_EVENT_COLUMNS).order("date"),
  ]);

  // The tables arrive with the home banner database update. Until then both
  // reads fail.
  const settings =
    !rowError && !slideError && row ? (row as unknown as HomeBannerSettings) : null;

  // Upcoming events, plus any event the banner already links to, even if it
  // has passed, so the dropdowns can still show the saved choice.
  const now = new Date();
  const linked = new Set([settings?.link_event_id, settings?.event_section_event_id]);
  const events = ((eventRows ?? []) as BannerEvent[])
    .map((event) => ({ ...event, over: !isEventUpcoming(event, now) }))
    .filter((event) => !event.over || linked.has(event.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Home banner</h1>
        <p className="text-sm text-muted-foreground">
          A banner with photos, a message and a button at the top of the home
          page. It shows only while it&apos;s switched on.
        </p>
      </div>
      {settings ? (
        <BannerEditor
          initialSettings={settings}
          initialSlides={(slideRows ?? []) as HomeBannerSlide[]}
          products={(productRows ?? []) as BannerProduct[]}
          events={events}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>The banner isn&apos;t set up yet</CardTitle>
            <CardDescription>
              The database doesn&apos;t have the banner tables yet. They arrive
              with the home banner database update. Once it is applied, reload
              this page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
