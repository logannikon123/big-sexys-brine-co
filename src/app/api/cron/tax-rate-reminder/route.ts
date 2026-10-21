import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { storeDate } from "@/lib/checkout/dates";
import { taxReminderFor, type TaxReminder } from "@/lib/tax-reminders";

/**
 * GET /api/cron/tax-rate-reminder
 *
 * Vercel runs this once a day (see vercel.json). On the dates listed in
 * src/lib/tax-reminders.ts it sends Jesse an urgent Pushover alert and an
 * urgent email to ORDER_ALERT_EMAIL, reminding him to update the food tax
 * table before Colorado's rates change. Every other day it does nothing.
 *
 * Vercel signs each run with CRON_SECRET, so nobody else can trigger it.
 * Without CRON_SECRET the route refuses every request.
 *
 * For testing, ?date=YYYY-MM-DD pretends it is that Colorado date, and
 * ?dryRun=1 returns the reminder without sending it.
 */

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");
const FROM = "Big Sexy's Brine Co. <noreply@bigsexysbrine.co>";
const NO_STORE = { "Cache-Control": "no-store" };

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** One line about the table, like "34 rows, last changed Oct 21, 2026, all confirmed." */
async function tableSummary(): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    );
    const { data, error } = await supabase.from("food_tax_rates").select("updated_at, confirmed");
    if (error || !data) return null;
    const rows = data as { updated_at: string; confirmed: boolean }[];
    const latest = rows.reduce((max, row) => (row.updated_at > max ? row.updated_at : max), "");
    const unconfirmed = rows.filter((row) => !row.confirmed).length;
    const changed = latest
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" }).format(new Date(latest))
      : "never";
    return `The food tax table has ${rows.length} rows, last changed ${changed}, ${unconfirmed === 0 ? "all confirmed" : `${unconfirmed} not confirmed`}.`;
  } catch {
    return null;
  }
}

function messageText(reminder: TaxReminder, summary: string | null): string {
  return [
    ...reminder.lines,
    "",
    ...(summary ? [summary] : []),
    `Edit the table: ${SITE_URL}/admin/tax`,
  ].join("\n");
}

async function sendPushover(reminder: TaxReminder, text: string): Promise<boolean> {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  if (!token || !user) {
    console.error("Tax reminder: PUSHOVER_TOKEN or PUSHOVER_USER is not set, so no phone alert.");
    return false;
  }
  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      user,
      title: reminder.title,
      // Pushover allows 1024 characters.
      message: text.slice(0, 1024),
      // High priority: sounds even during the phone's quiet hours.
      priority: 1,
      url: `${SITE_URL}/admin/tax`,
      url_title: "Open Tax rates",
    }),
  });
  if (!res.ok) console.error("Tax reminder: Pushover refused the alert:", res.status);
  return res.ok;
}

async function sendEmail(reminder: TaxReminder, text: string): Promise<boolean> {
  const to = process.env.ORDER_ALERT_EMAIL;
  if (!process.env.RESEND_API_KEY || !to) {
    console.error("Tax reminder: RESEND_API_KEY or ORDER_ALERT_EMAIL is not set, so no email.");
    return false;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: reminder.title.startsWith("URGENT") ? reminder.title : `URGENT: ${reminder.title}`,
    // Marks the email high importance in Gmail, Outlook and Apple Mail.
    headers: { Importance: "high", "X-Priority": "1" },
    text,
  });
  if (result.error) console.error("Tax reminder: Resend refused the email:", result.error.message);
  return !result.error;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    if (!process.env.CRON_SECRET) console.error("Tax reminder: CRON_SECRET is not set, so the reminder can't run.");
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  const params = request.nextUrl.searchParams;
  const asked = params.get("date");
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : storeDate(new Date());
  const reminder = taxReminderFor(date);
  if (!reminder) {
    return NextResponse.json({ ok: true, date, reminder: null }, { headers: NO_STORE });
  }

  const text = messageText(reminder, await tableSummary());
  if (params.get("dryRun") === "1") {
    return NextResponse.json({ ok: true, date, reminder: reminder.kind, title: reminder.title, text, sent: false }, { headers: NO_STORE });
  }

  const [pushover, email] = await Promise.all([
    sendPushover(reminder, text).catch(() => false),
    sendEmail(reminder, text).catch(() => false),
  ]);
  return NextResponse.json({ ok: true, date, reminder: reminder.kind, sent: { pushover, email } }, { headers: NO_STORE });
}
