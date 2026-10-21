import { Download, Info } from "lucide-react";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DetailsSwitch } from "@/components/admin/marketing/details-switch";
import { SubscribersList } from "@/components/admin/marketing/subscribers-list";
import { ConsentLog } from "@/components/admin/marketing/consent-log";
import { subscriberCountText } from "@/components/admin/marketing/marketing-format";
import {
  loadConsentLog,
  loadSubscribers,
  type LoadProblem,
} from "./marketing-data";

function Problem({ problem }: { problem: Exclude<LoadProblem, null> }) {
  if (problem === "missing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The marketing table isn&apos;t set up yet.</CardTitle>
          <CardDescription>
            It arrives with the marketing consent database update. Once that is
            applied, reload this page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="py-10 text-center text-red-300">
        The marketing list didn&apos;t load. Reload the page. If it keeps
        happening, tell Nick.
      </CardContent>
    </Card>
  );
}

export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ details?: string | string[] }>;
}) {
  await requireAuth();
  const { details: detailsParam } = await searchParams;
  const details = (Array.isArray(detailsParam) ? detailsParam[0] : detailsParam) === "1";

  const [subscribers, log] = await Promise.all([
    loadSubscribers(),
    details ? loadConsentLog() : Promise.resolve(null),
  ]);
  const problem = subscribers.problem ?? log?.problem ?? null;

  return (
    // Extra room on phones so the menu button doesn't cover the title.
    <div className="space-y-6 pt-8 lg:pt-0">
      <div>
        <h1 className="font-display text-2xl font-bold">Marketing emails</h1>
        <p className="text-sm text-muted-foreground">
          People who agreed to get marketing emails from you.
        </p>
      </div>

      <div className="flex gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
        <p>
          Only people who ticked the box are listed. Every marketing email you
          send must include an unsubscribe link and the business&apos;s mailing
          address. When someone unsubscribes in your email tool, press
          Unsubscribe here too.
        </p>
      </div>

      {problem ? (
        <Problem problem={problem} />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-semibold">
              {subscriberCountText(subscribers.rows.length)}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* Plain links: the browser saves the file. */}
              <Button asChild variant="outline" className="h-11 sm:h-9">
                <a href="/admin/marketing/export?list=subscribers" download>
                  <Download className="h-4 w-4" />
                  Download list (CSV)
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 sm:h-9">
                <a href="/admin/marketing/export?list=log" download>
                  <Download className="h-4 w-4" />
                  Download with consent details (CSV)
                </a>
              </Button>
            </div>
          </div>

          <DetailsSwitch on={details} />

          {details && log ? (
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-lg font-bold">Consent log</h2>
                <p className="text-sm text-muted-foreground">
                  Every opt-in and unsubscribe, newest first. Rows are never
                  changed or deleted, so this is your proof of how you got
                  each address.
                </p>
              </div>
              <ConsentLog rows={log.rows} />
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold">Subscribers</h2>
              <SubscribersList rows={subscribers.rows} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
