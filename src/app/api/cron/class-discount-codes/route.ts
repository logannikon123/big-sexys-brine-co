import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { alertOwner, errorMessage } from "@/lib/alerts";
import { sendClassDiscountCodes } from "@/lib/classes/discount-codes";

/**
 * GET /api/cron/class-discount-codes
 *
 * Vercel runs this once a day (see vercel.json). It emails each class guest
 * their 10% off code the day after class. See src/lib/classes/discount-codes.ts.
 *
 * Vercel signs each run with CRON_SECRET, so nobody else can trigger it.
 * Without CRON_SECRET the route refuses every request. ?dryRun=1 counts the
 * codes due without making or sending any.
 */

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bigsexysbrine.co").trim().replace(/\/$/, "");
const NO_STORE = { "Cache-Control": "no-store" };

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    if (!process.env.CRON_SECRET) console.error("Class discount codes: CRON_SECRET is not set, so the job can't run.");
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  try {
    const result = await sendClassDiscountCodes(new Date(), dryRun);
    return NextResponse.json({ ok: true, dryRun, ...result }, { headers: NO_STORE });
  } catch (error) {
    console.error("Class discount codes failed:", errorMessage(error));
    await alertOwner({
      key: "class:discount-codes",
      title: "Class discount codes didn't go out",
      message: `The daily job that emails class guests their discount code failed (${errorMessage(error)}). It tries again tomorrow.`,
      url: `${SITE_URL}/admin/classes`,
      windowHours: 20,
    });
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
  }
}
