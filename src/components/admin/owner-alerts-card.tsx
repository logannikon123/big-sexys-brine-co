import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The dashboard's Alerts card: the latest problems the site warned Jesse
 * about (src/lib/alerts.ts), newest first. Only admins can read the
 * owner_alerts table, and it holds no customer details.
 */

interface AlertRow {
  key: string;
  title: string;
  count: number;
  last_seen_at: string;
  last_sent_at: string | null;
}

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  }).format(new Date(iso));
}

export async function OwnerAlertsCard() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("owner_alerts")
    .select("key, title, count, last_seen_at, last_sent_at")
    .order("last_seen_at", { ascending: false })
    .limit(5);
  // Leave the card off rather than break the dashboard.
  if (error) return null;
  const alerts = (data ?? []) as AlertRow[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Alerts</CardTitle>
        <BellRing className="h-4 w-4 text-brand-orange" />
      </CardHeader>
      <CardContent>
        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.key} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground">
                  Last seen {when(alert.last_seen_at)}
                  {alert.count > 1 ? `, ${alert.count} times in all` : ""}.{" "}
                  {alert.last_sent_at ? `Last sent ${when(alert.last_sent_at)}.` : "The alert didn't get through."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No problems so far.</p>
        )}
      </CardContent>
    </Card>
  );
}
