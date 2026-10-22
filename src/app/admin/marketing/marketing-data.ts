/**
 * Loads the marketing consent log for /admin/marketing and its CSV
 * downloads. Server code only. Every read uses the signed-in admin's own
 * session, so the database rules decide what comes back.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ConsentAction = "opt_in" | "opt_out";
export type ConsentEventSource = "checkout" | "contest" | "admin";

/** One person on the list: their newest choice is opt_in. */
export interface MarketingSubscriber {
  email: string;
  name: string | null;
  source: ConsentEventSource;
  consent_version: string | null;
  opted_in_at: string;
}

/** One row of the consent log, with the order number if it has an order. */
export interface ConsentEvent {
  id: number;
  email: string;
  name: string | null;
  action: ConsentAction;
  source: ConsentEventSource;
  consent_text: string | null;
  consent_version: string | null;
  ip_address: string | null;
  user_agent: string | null;
  order_id: string | null;
  order_number: number | null;
  contest_entry_id: number | null;
  recorded_by: string | null;
  note: string | null;
  created_at: string;
}

/** What went wrong, if anything. */
export type LoadProblem = "missing" | "failed" | null;

export interface LoadResult<T> {
  rows: T[];
  problem: LoadProblem;
}

/** The database reads at most this many rows per request. */
const PAGE_SIZE = 1000;

const EVENT_COLUMNS =
  "id, email, name, action, source, consent_text, consent_version, ip_address, user_agent, order_id, contest_entry_id, recorded_by, note, created_at, orders(order_number)";

type EventQueryRow = Omit<ConsentEvent, "order_number" | "id"> & {
  id: number | string;
  orders: { order_number: number } | { order_number: number }[] | null;
};

/**
 * True when the table or view isn't in the database yet. Postgres says
 * 42P01; Supabase's API says PGRST205 when a table isn't in its list.
 */
function isMissingTable(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /marketing_\w+.*(does not exist|schema cache)/i.test(error.message)
  );
}

function problemFor(error: { code?: string; message: string }, what: string): LoadProblem {
  if (isMissingTable(error)) return "missing";
  // The message is about the query, not about anyone on the list.
  console.error(`Loading ${what} failed:`, error.message);
  return "failed";
}

/**
 * Read every page of a query, so no one is left off a legal record. A row
 * added while we read pushes the rest down one place, so the next page can
 * repeat a row; `key` drops the repeat.
 */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { code?: string; message: string } | null;
  }>,
  key: (row: T) => string,
  what: string
): Promise<LoadResult<T>> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { rows: [], problem: problemFor(error, what) };
    const batch = (data ?? []) as T[];
    for (const row of batch) {
      const k = key(row);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(row);
    }
    if (batch.length < PAGE_SIZE) return { rows, problem: null };
  }
}

/** Everyone who agreed to marketing emails, newest first. */
export async function loadSubscribers(): Promise<LoadResult<MarketingSubscriber>> {
  const supabase = await createClient();
  return readAll<MarketingSubscriber>(
    (from, to) =>
      supabase
        .from("marketing_subscribers")
        .select("email, name, source, consent_version, opted_in_at")
        .order("opted_in_at", { ascending: false })
        .order("email", { ascending: true })
        .range(from, to),
    (row) => row.email,
    "the marketing list"
  );
}

/** The whole consent log, newest first. */
export async function loadConsentLog(): Promise<LoadResult<ConsentEvent>> {
  const supabase = await createClient();
  const result = await readAll<EventQueryRow>(
    (from, to) =>
      supabase
        .from("marketing_consent_events")
        .select(EVENT_COLUMNS)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    (row) => String(row.id),
    "the marketing consent log"
  );

  return {
    problem: result.problem,
    rows: result.rows.map(({ orders, id, ...row }) => {
      const order = Array.isArray(orders) ? orders[0] : orders;
      return { ...row, id: Number(id), order_number: order?.order_number ?? null };
    }),
  };
}
