import Link from "next/link";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { CLASS_POLICY_TEXT } from "@/lib/classes/format";
import { AddClassSession } from "@/components/admin/classes/add-class-session";
import { ClassSessionCard } from "@/components/admin/classes/class-session-card";
import { loadClassSessions } from "./class-data";

export default async function AdminClassSessionsPage() {
  await requireAuth();
  const { upcoming, past, defaultPriceCents, error } = await loadClassSessions();
  const none = upcoming.length === 0 && past.length === 0;

  return (
    // Extra room on phones so the menu button doesn't cover the title.
    <div className="space-y-6 pt-8 lg:pt-0">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold">Class sessions</h1>
        <p className="text-sm text-muted-foreground">
          The dates people can book for the class, and who booked. Times are
          Colorado time. The class description and default price live on{" "}
          <Link href="/admin/class" className="text-brand-orange underline underline-offset-4">
            Class Info
          </Link>
          .
        </p>
      </div>

      <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm">
        <p className="font-medium">Refund rule customers see</p>
        <p className="mt-1 text-muted-foreground">{CLASS_POLICY_TEXT}</p>
        <p className="mt-2 text-muted-foreground">
          Customers can&apos;t cancel online. When someone asks, cancel their
          booking below: the site refunds through Square when the rule allows,
          or when you tick Special case.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <AddClassSession defaultPriceCents={defaultPriceCents} startOpen={none && !error} />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No class dates coming up. Add one above.
          </p>
        ) : (
          upcoming.map((session) => (
            <ClassSessionCard
              key={session.id}
              session={session}
              defaultPriceCents={defaultPriceCents}
            />
          ))
        )}
      </section>

      {past.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-display text-xl font-bold">
            Past classes ({past.length})
          </summary>
          <div className="mt-4 space-y-4">
            {past.map((session) => (
              <ClassSessionCard
                key={session.id}
                session={session}
                defaultPriceCents={defaultPriceCents}
                past
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
