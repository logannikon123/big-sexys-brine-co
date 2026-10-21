import "server-only";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  consentEmail,
  MARKETING_CONSENT_TEXT,
  MARKETING_CONSENT_VERSION,
  type OptInRecord,
} from "@/lib/marketing";

/** The visitor's IP address and browser, kept as proof of an opt-in. */
export function consentContext(request: NextRequest): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  const userAgent = request.headers.get("user-agent");
  return { ipAddress: ip, userAgent: userAgent ? userAgent.slice(0, 500) : null };
}

/**
 * Add an opt_in row to the consent log. Never throws: a customer's order or
 * contest entry must not fail because the marketing record didn't save.
 */
export async function recordMarketingOptIn(record: OptInRecord): Promise<void> {
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.from("marketing_consent_events").insert({
      email: consentEmail(record.email),
      name: record.name?.trim() || null,
      action: "opt_in",
      source: record.source,
      consent_text: MARKETING_CONSENT_TEXT,
      consent_version: MARKETING_CONSENT_VERSION,
      ip_address: record.ipAddress ?? null,
      user_agent: record.userAgent ?? null,
      order_id: record.orderId ?? null,
      contest_entry_id: record.contestEntryId ?? null,
    });
    if (error) console.error("Marketing opt-in: couldn't save it:", error.message);
  } catch (error) {
    console.error(
      "Marketing opt-in failed:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
}
