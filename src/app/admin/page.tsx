import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  CalendarDays,
  MessageSquareQuote,
  Images,
  ShoppingBag,
  ChartColumn,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { ClearCacheButton } from "@/components/admin/clear-cache-button";
import { countNewOrders } from "@/app/admin/orders/order-data";
import { OwnerAlertsCard } from "@/components/admin/owner-alerts-card";
import { formatEventDay, isEventUpcoming } from "@/lib/event-dates";

export default async function AdminDashboardPage() {
  await requireAuth();
  const supabase = await createClient();

  const [
    { count: productCount },
    { count: eventCount },
    { count: testimonialCount },
    { count: galleryCount },
    newOrderCount,
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("testimonials").select("*", { count: "exact", head: true }),
    supabase.from("gallery_images").select("*", { count: "exact", head: true }),
    countNewOrders(),
  ]);

  // Get upcoming events — match public events page logic: include recurring
  // events while their end_date is still in the future, even if their start
  // date has passed. Sorted chronologically (closest first) for at-a-glance.
  const { data: allEvents } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: true });
  const now = new Date();
  const upcomingEvents = (allEvents ?? [])
    .filter((e) => isEventUpcoming(e, now))
    .slice(0, 5);

  // Get recent testimonials
  const { data: recentTestimonials } = await supabase
    .from("testimonials")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);

  const stats = [
    {
      // Paid orders waiting to be packed.
      label: "New orders",
      value: newOrderCount,
      icon: ShoppingBag,
      href: "/admin/orders",
      color: "text-brand-orange",
      highlight: newOrderCount > 0,
    },
    {
      label: "Products",
      value: productCount ?? 0,
      icon: Package,
      href: "/admin/products",
      color: "text-brand-orange",
    },
    {
      label: "Events",
      value: eventCount ?? 0,
      icon: CalendarDays,
      href: "/admin/events",
      color: "text-brand-gold",
    },
    {
      label: "Testimonials",
      value: testimonialCount ?? 0,
      icon: MessageSquareQuote,
      href: "/admin/testimonials",
      color: "text-brand-green",
    },
    {
      label: "Gallery Images",
      value: galleryCount ?? 0,
      icon: Images,
      href: "/admin/gallery",
      color: "text-brand-cream",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome to Big Sexy&apos;s admin panel
          </p>
        </div>
        <ClearCacheButton variant="outline" size="sm" label="Clear Cache" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card
              className={
                "highlight" in stat && stat.highlight
                  ? "border-brand-orange transition-colors hover:border-brand-orange/70"
                  : "hover:border-muted-foreground/30 transition-colors"
              }
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Link
        href="/admin/sales"
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30"
      >
        <ChartColumn className="h-6 w-6 shrink-0 text-brand-orange" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Sales</p>
          <p className="text-sm text-muted-foreground">
            Money taken in, best sellers and customers. Download as CSV.
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <OwnerAlertsCard />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{event.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.location}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatEventDay(event.date, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming events
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Testimonials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Testimonials</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTestimonials && recentTestimonials.length > 0 ? (
              <div className="space-y-3">
                {recentTestimonials.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-md border border-border p-3"
                  >
                    <p className="text-sm text-muted-foreground line-clamp-2 italic">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <p className="mt-1 text-xs font-medium">— {t.author}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No testimonials yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
