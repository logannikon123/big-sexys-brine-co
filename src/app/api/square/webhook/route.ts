import { NextRequest, NextResponse } from "next/server";
import { WebhooksHelper } from "square";
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
 */

export async function POST(request: NextRequest) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL;
  if (!signatureKey || !notificationUrl) {
    console.error("Square webhook: SQUARE_WEBHOOK_SIGNATURE_KEY or SQUARE_WEBHOOK_URL is not set.");
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
    // An error answer makes Square send the message again later.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
