import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { alertOwner, isLiveSite, missingAlertSettings, type AlertResult } from "@/lib/alerts";
import { squareEnvironment } from "@/lib/square";

/**
 * GET /api/cron/health-check
 *
 * Vercel runs this every 15 minutes (see vercel.json). It looks for signs
 * that something failed without anyone noticing, and sends Jesse one alert
 * for each kind of problem it finds (src/lib/alerts.ts, which also keeps a
 * repeating problem to one alert every few hours):
 *
 * - paid orders with no new-order alert after 10 minutes,
 * - orders still waiting on payment after 30 minutes,
 * - Square webhook messages saved but never handled after 30 minutes,
 * - the food tax table can't be read, or has no confirmed rates,
 * - alert settings missing on the live site.
 *
 * It only reads, with one exception: once its alert about paid orders with
 * no new-order alert gets through, it marks those orders announced
 * (alerted_at), so the same orders don't alert again every few hours for a
 * week. Alerts name order numbers, never customer details. Orders
 * are checked for this copy's Square account only, so test orders from
 * local and preview copies never alert the live site. Problems older than a
 * week are left out, so an old one stops alerting on its own.
 *
 * Vercel signs each run with CRON_SECRET, so nobody else can trigger it.
 * Without CRON_SECRET the route refuses every request. For testing,
 * ?dryRun=1 returns the alerts without sending them, on any copy. Local and
 * preview copies never send anyway: alertOwner only logs there.
 */

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");
const NO_STORE = { "Cache-Control": "no-store" };
const MINUTE = 60 * 1000;
const LOOK_BACK = 7 * 24 * 60 * MINUTE;
const MAX_NUMBERS = 10;

/** Statuses that mean the money was taken. Matches src/lib/checkout/pay.ts. */
const PAID_STATUSES = ["paid", "ready_for_pickup", "out_for_delivery", "shipped", "fulfilled"];
/** Statuses that mean we're still waiting to hear whether the card was charged. */
const WAITING_STATUSES = ["pending_payment"];

interface Problem {
  kind: string;
  key: string;
  title: string;
  message: string;
  url: string;
  count: number;
  /** For unalerted_paid: the orders to mark announced once the alert is out. */
  orderNumbers?: number[];
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const ago = (now: number, ms: number) => new Date(now - ms).toISOString();

/** "#1001, #1002 and 3 more" */
function numberList(numbers: number[]): string {
  const shown = numbers.slice(0, MAX_NUMBERS).map((n) => `#${n}`).join(", ");
  return numbers.length > MAX_NUMBERS ? `${shown} and ${numbers.length - MAX_NUMBERS} more` : shown;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

async function findProblems(now: number): Promise<Problem[]> {
  const problems: Problem[] = [];
  const supabase = await createServiceClient();
  const environment = squareEnvironment();
  const since = ago(now, LOOK_BACK);

  // 1. Paid, but Jesse was never told. alerted_at is set when the new-order
  // alert starts, and cleared again if neither the phone alert nor the alert
  // email got through (src/lib/orders/notify.ts).
  const unalerted = await supabase
    .from("orders")
    .select("order_number")
    .in("status", PAID_STATUSES)
    .eq("square_environment", environment)
    .is("alerted_at", null)
    .lt("paid_at", ago(now, 10 * MINUTE))
    .gt("paid_at", since)
    .order("order_number", { ascending: true });
  if (unalerted.error) {
    problems.push(databaseProblem("orders", unalerted.error.message));
  } else if (unalerted.data.length > 0) {
    const numbers = unalerted.data.map((row) => row.order_number as number);
    problems.push({
      kind: "unalerted_paid",
      // A new order gets its own alert, even inside the window.
      key: `health:unalerted-paid:${numbers[numbers.length - 1]}`,
      title: `${plural(numbers.length, "paid order", "paid orders")} with no new-order alert`,
      message: `Paid more than 10 minutes ago, but the new-order alert never went out: ${numberList(numbers)}. Check the orders and pack them as normal.`,
      url: `${SITE_URL}/admin/orders`,
      count: numbers.length,
      orderNumbers: numbers,
    });
  }

  // 2. Still waiting on payment. Square may have the card but not settled
  // it, or checkout lost Square's answer.
  const waiting = await supabase
    .from("orders")
    .select("order_number, square_payment_id")
    .in("status", WAITING_STATUSES)
    .eq("square_environment", environment)
    .lt("created_at", ago(now, 30 * MINUTE))
    .gt("created_at", since)
    .order("order_number", { ascending: true });
  if (waiting.error) {
    problems.push(databaseProblem("orders", waiting.error.message));
  } else if (waiting.data.length > 0) {
    const numbers = waiting.data.map((row) => row.order_number as number);
    const withPayment = waiting.data.filter((row) => row.square_payment_id).length;
    problems.push({
      kind: "stuck_pending",
      key: `health:stuck-pending:${numbers[numbers.length - 1]}`,
      title: `${plural(numbers.length, "order", "orders")} stuck waiting on payment`,
      message: [
        `Still waiting on payment after 30 minutes: ${numberList(numbers)}.`,
        `${withPayment} of them have a Square payment on file and ${numbers.length - withPayment} have none.`,
        "Look each one up in Square to see whether the card was charged.",
      ].join(" "),
      url: `${SITE_URL}/admin/orders`,
      count: numbers.length,
    });
  }

  // 3. Square messages saved but never handled. The webhook marks each one
  // processed when it finishes, and Square sends a failed one again, so one
  // left over after 30 minutes has most likely failed more than once.
  const events = await supabase
    .from("square_webhook_events")
    .select("event_type")
    .is("processed_at", null)
    .lt("received_at", ago(now, 30 * MINUTE))
    .gt("received_at", since);
  if (events.error) {
    problems.push(databaseProblem("square_webhook_events", events.error.message));
  } else if (events.data.length > 0) {
    const types = [...new Set(events.data.map((row) => row.event_type as string))].sort();
    problems.push({
      kind: "webhook_unprocessed",
      key: "health:webhook-unprocessed",
      title: `${plural(events.data.length, "Square message", "Square messages")} not handled`,
      message: `The site saved ${plural(events.data.length, "message", "messages")} from Square but never finished handling them (${types.join(", ")}). A payment, refund or dispute may be missing from an order. Check Vercel's logs for "Square webhook" errors.`,
      url: `${SITE_URL}/admin/orders`,
      count: events.data.length,
    });
  }

  // 4. The food tax table, read the way checkout reads it (the public key),
  // so a broken read rule shows up too.
  const tax = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false } }
  )
    .from("food_tax_rates")
    .select("confirmed");
  const confirmed = (tax.data ?? []).filter((row) => row.confirmed).length;
  if (tax.error || confirmed === 0) {
    problems.push({
      kind: "tax_table",
      key: "health:tax-table",
      title: "Checkout can't read the food tax table",
      message: tax.error
        ? `Reading the food tax table failed (${tax.error.message}). Checkout may be charging no local tax or turning orders away.`
        : `The food tax table has ${plural((tax.data ?? []).length, "row", "rows")} and none are confirmed, so checkout charges no local tax.`,
      url: `${SITE_URL}/admin/tax`,
      count: 1,
    });
  }

  // 5. On the live site, every alert setting must be there.
  const missing = missingAlertSettings();
  if (isLiveSite() && missing.length > 0) {
    problems.push({
      kind: "alert_settings",
      key: "health:alert-settings",
      title: "Alert settings missing on the live site",
      message: `These settings are not set in Vercel: ${missing.join(", ")}. New-order alerts and problem alerts can't reach you through them.`,
      url: `${SITE_URL}/admin`,
      count: missing.length,
    });
  }

  // The same table failing twice is one problem.
  return problems.filter((p, i) => problems.findIndex((q) => q.key === p.key) === i);
}

function databaseProblem(table: string, error: string): Problem {
  return {
    kind: "database",
    key: `health:database:${table}`,
    title: "The health check couldn't read the database",
    message: `Reading ${table} failed (${error}). Checkout and order alerts may be failing too.`,
    url: `${SITE_URL}/admin`,
    count: 1,
  };
}

/** Jesse now knows about these paid orders, so stop alerting about them. */
async function markAnnounced(orderNumbers: number[]) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("orders")
    .update({ alerted_at: new Date().toISOString() })
    .in("order_number", orderNumbers)
    .is("alerted_at", null);
  if (error) console.error("Health check: couldn't mark orders announced:", error.message);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    if (!process.env.CRON_SECRET) console.error("Health check: CRON_SECRET is not set, so the check can't run.");
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  const now = Date.now();
  let problems: Problem[];
  try {
    problems = await findProblems(now);
  } catch (error) {
    problems = [databaseProblem("the database", error instanceof Error ? error.message : "unknown error")];
  }

  const base = {
    ok: true,
    checkedAt: new Date(now).toISOString(),
    squareEnvironment: squareEnvironment(),
    liveSite: isLiveSite(),
    // Names only, never values.
    missingSettings: missingAlertSettings(),
  };

  if (request.nextUrl.searchParams.get("dryRun") === "1") {
    return NextResponse.json({ ...base, dryRun: true, problems, sent: false }, { headers: NO_STORE });
  }

  const sent: (Pick<Problem, "kind" | "key"> & AlertResult)[] = [];
  for (const problem of problems) {
    const result = await alertOwner({
      key: problem.key,
      title: problem.title,
      message: problem.message,
      url: problem.url,
    });
    sent.push({ kind: problem.kind, key: problem.key, ...result });
    if (result.sent && problem.orderNumbers) await markAnnounced(problem.orderNumbers);
  }
  return NextResponse.json(
    { ...base, problems: problems.map(({ kind, key, count }) => ({ kind, key, count })), sent },
    { headers: NO_STORE }
  );
}
