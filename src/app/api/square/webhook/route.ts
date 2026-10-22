import { NextRequest, NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import { alertOwnerLater, errorMessage } from "@/lib/alerts";
import { handleSquareEvent, type SquareEvent } from "@/lib/square-webhook";

/**
 * POST /api/square/webhook
 *
 * Square sends a message here when a payment, refund or dispute changes.
 * Each message carries a signature made with a secret key that only Square
 * and this site know (SQUARE_WEBHOOK_SIGNATURE_KEY), over the exact web
 * address it was sent to (SQUARE_WEBHOOK_URL). A message with a wrong or
 * missing signature is refused, so nobody else can mark an order paid.
 *
 * What each message does: src/lib/square-webhook.ts.
 *
 * Missing settings and failed messages also alert Jesse (src/lib/alerts.ts).
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");

export async function POST(request: NextRequest) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL;
  if (!signatureKey || !notificationUrl) {
    console.error("Square webhook: SQUARE_WEBHOOK_SIGNATURE_KEY or SQUARE_WEBHOOK_URL is not set.");
    alertOwnerLater({
      key: "webhook:settings",
      title: "Square webhook settings missing",
      message:
        "SQUARE_WEBHOOK_SIGNATURE_KEY or SQUARE_WEBHOOK_URL is not set in Vercel, so the site turns away every message from Square (payments, refunds, disputes). Square keeps trying for a while, so set them and redeploy soon.",
      url: `${SITE_URL}/admin/orders`,
      windowHours: 24,
    });
    // Square tries again later, so nothing is lost while the settings are fixed.
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  // The signature covers the body exactly as sent, so read it as text.
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  const valid =
    signature !== "" &&
    (await WebhooksHelper.verifySignature({
      requestBody: body,
      signatureHeader: signature,
      signatureKey,
      notificationUrl,
    }));
  if (!valid) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let event: SquareEvent;
  try {
    event = JSON.parse(body) as SquareEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof event?.event_id !== "string" || typeof event?.type !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const result = await handleSquareEvent(event);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error(
      "Square webhook failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    alertOwnerLater({
      key: "webhook:handler-failed",
      title: "A message from Square failed",
      message: `The site couldn't handle a ${event.type} message from Square (${errorMessage(error)}). Square sends it again later, so it may fix itself. If not, a payment, refund or dispute may be missing from an order.`,
      url: `${SITE_URL}/admin/orders`,
    });
    // An error answer makes Square send the message again later.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
