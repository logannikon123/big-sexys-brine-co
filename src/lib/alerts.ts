import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  claimAlert,
  memoryAlertStore,
  releaseAlert,
  type AlertRow,
  type AlertStore,
} from "@/lib/alert-limit";

/**
 * Tell Jesse that something broke: a high-priority Pushover alert on his
 * phone and an email to ORDER_ALERT_EMAIL.
 *
 * How to use it, from any server code:
 *
 *   import { alertOwner } from "@/lib/alerts";
 *
 *   await alertOwner({
 *     key: "pay:no-answer",
 *     title: "Checkout couldn't reach Square",
 *     message: `Order #${orderNumber} is waiting. The customer may try again.`,
 *     url: `${SITE_URL}/admin/orders/${orderId}`,
 *   });
 *
 * - key names the problem. Each key sends at most one alert every 3 hours
 *   (windowHours changes that), so a problem that repeats doesn't flood the
 *   phone. Use one key per kind of problem ("webhook:handler-failed"), and
 *   add an order number only when each order needs its own alert.
 * - title and message go out as written, so never put customer names,
 *   emails, phone numbers or addresses in them. Order numbers are fine.
 * - url, if given, is the link in the phone alert and the email.
 * - It never throws, and a failed send never stops the caller. Inside a
 *   request, run it after the answer with next/server's after(), as pay.ts
 *   does for order alerts, so the customer never waits on it.
 * - Outside the live site (local or preview copies) the title starts with
 *   TEST.
 *
 * The rate limit lives in the owner_alerts table, written here with the
 * service role key. If the database can't be reached, each server keeps
 * its own count in memory instead, and the alert still goes out.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");
const FROM = "Big Sexy's Brine Co. <noreply@bigsexysbrine.co>";
const DEFAULT_WINDOW_HOURS = 3;

export interface OwnerAlert {
  /** Names the problem, for the rate limit. Like "health:stuck-pending". */
  key: string;
  title: string;
  message: string;
  /** A link to open, like the admin order page. */
  url?: string;
  /** Hours between alerts for the same key. Default 3. */
  windowHours?: number;
}

export interface AlertResult {
  /** False when the same key sent an alert recently, so this one was held back. */
  sent: boolean;
  count: number;
  pushover: boolean;
  email: boolean;
}

/** The alert settings that aren't set, by name. */
export function missingAlertSettings(): string[] {
  return ["PUSHOVER_TOKEN", "PUSHOVER_USER", "RESEND_API_KEY", "ORDER_ALERT_EMAIL"].filter(
    (name) => !process.env[name]
  );
}

/** True on the live site. Preview and local copies are tests. */
export function isLiveSite(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** The owner_alerts table, for the rate limit in src/lib/alert-limit.ts. */
function databaseStore(): AlertStore {
  const table = async () => (await createServiceClient()).from("owner_alerts");
  return {
    async get(key) {
      const { data, error } = await (await table())
        .select("key, title, count, last_seen_at, last_sent_at")
        .eq("key", key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as AlertRow | null) ?? null;
    },
    async insert(row) {
      const { error } = await (await table()).insert(row);
      if (!error) return true;
      if (error.code === "23505") return false;
      throw new Error(error.message);
    },
    async update(key, expectedLastSentAt, fields) {
      const query = (await table()).update(fields).eq("key", key);
      const { data, error } = await (expectedLastSentAt === null
        ? query.is("last_sent_at", null)
        : query.eq("last_sent_at", expectedLastSentAt)
      ).select("key");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
  };
}

// Used only while the database is down. Each server has its own.
const fallbackStore = memoryAlertStore();

async function sendPushover(alert: OwnerAlert, title: string, text: string): Promise<boolean> {
  const token = process.env.PUSHOVER_TOKEN;
  const user = process.env.PUSHOVER_USER;
  if (!token || !user) {
    console.error("Owner alert: PUSHOVER_TOKEN or PUSHOVER_USER is not set, so no phone alert.");
    return false;
  }
  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      user,
      // Pushover allows a 250 character title and a 1024 character message.
      title: title.slice(0, 250),
      message: text.slice(0, 1024),
      // High priority: sounds even during the phone's quiet hours.
      priority: 1,
      ...(alert.url ? { url: alert.url.slice(0, 512), url_title: "Open" } : {}),
    }),
  });
  if (!res.ok) console.error("Owner alert: Pushover refused the alert:", res.status);
  return res.ok;
}

async function sendEmail(alert: OwnerAlert, title: string, text: string): Promise<boolean> {
  const to = process.env.ORDER_ALERT_EMAIL;
  if (!process.env.RESEND_API_KEY || !to) {
    console.error("Owner alert: RESEND_API_KEY or ORDER_ALERT_EMAIL is not set, so no email.");
    return false;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: title,
    // Marks the email high importance in Gmail, Outlook and Apple Mail.
    headers: { Importance: "high", "X-Priority": "1" },
    text: [text, ...(alert.url ? ["", `Open: ${alert.url}`] : []), "", `Admin: ${SITE_URL}/admin`].join("\n"),
  });
  if (result.error) console.error("Owner alert: Resend refused the email:", result.error.message);
  return !result.error;
}

/** Alert Jesse, at most once per key every few hours. Never throws. */
export async function alertOwner(alert: OwnerAlert): Promise<AlertResult> {
  const held = { sent: false, count: 0, pushover: false, email: false };
  try {
    const windowMs = (alert.windowHours ?? DEFAULT_WINDOW_HOURS) * 60 * 60 * 1000;
    const title = `${isLiveSite() ? "" : "TEST "}${alert.title}`;
    const input = { key: alert.key, title, now: new Date(), windowMs };

    let store = databaseStore();
    let claim;
    try {
      claim = await claimAlert(store, input);
    } catch (error) {
      console.error(
        "Owner alert: couldn't read owner_alerts, so the limit is kept in memory:",
        error instanceof Error ? error.message : "unknown error"
      );
      store = fallbackStore;
      claim = await claimAlert(store, input);
    }

    // Log every time, so the problem shows in Vercel's logs even when held back.
    console.error(`Owner alert [${alert.key}]: ${alert.title}${claim.send ? "" : " (held back, sent recently)"}`);
    if (!claim.send) return { ...held, count: claim.count };

    const hours = alert.windowHours ?? DEFAULT_WINDOW_HOURS;
    const text = [
      alert.message,
      "",
      claim.count > 1
        ? `This has come up ${claim.count} times so far. It alerts at most every ${hours} hours.`
        : `If it keeps happening, the next alert comes in ${hours} hours at the soonest.`,
    ].join("\n");

    const [pushover, email] = await Promise.all([
      sendPushover(alert, title, text).catch(() => false),
      sendEmail(alert, title, text).catch(() => false),
    ]);
    // Nothing got through: give the claim back so the next call tries again.
    if (!pushover && !email) await releaseAlert(store, alert.key, claim).catch(() => undefined);
    return { sent: pushover || email, count: claim.count, pushover, email };
  } catch (error) {
    console.error("Owner alert failed:", error instanceof Error ? error.message : "unknown error");
    return held;
  }
}
