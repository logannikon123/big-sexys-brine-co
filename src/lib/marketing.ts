/**
 * Marketing email consent: the checkbox wording, and saving a customer's
 * opt-in with proof (see
 * supabase/migrations/20261021032047_marketing_consent.sql).
 *
 * MARKETING_CONSENT_TEXT is shown next to the checkbox and saved with every
 * opt-in, so the record shows exactly what the person agreed to. If the
 * wording changes, change MARKETING_CONSENT_VERSION too.
 *
 * The box starts ticked (Jesse's choice), and the customer unticks it to
 * say no. The version says so, so each record shows how the box started.
 */

export const MARKETING_CONSENT_TEXT =
  "Email me about new flavors and where to find us, coupons, promotions, and special event details, etc.";

export const MARKETING_CONSENT_VERSION = "2026-10 (box ticked to start)";

export type ConsentSource = "checkout" | "contest";

export interface OptInRecord {
  email: string;
  name?: string | null;
  source: ConsentSource;
  ipAddress?: string | null;
  userAgent?: string | null;
  orderId?: string | null;
  contestEntryId?: number | null;
}

/** Normalise an email the way the consent log stores it. */
export function consentEmail(email: string): string {
  return email.trim().toLowerCase();
}
