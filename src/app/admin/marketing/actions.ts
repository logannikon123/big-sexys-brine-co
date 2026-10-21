"use server";

/**
 * Unsubscribe someone from /admin/marketing. This adds an opt_out row to
 * the consent log; it never changes or deletes the rows already there. The
 * database lets admins add only this kind of row.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuthAction } from "@/lib/supabase/auth-guard";
import { consentEmail } from "@/lib/marketing";

type ActionResult = { error?: string };

const NOTE_MAX = 500;

export async function unsubscribeMarketing(
  email: unknown,
  note: unknown
): Promise<ActionResult> {
  const user = await requireAuthAction();
  if (typeof email !== "string" || (note != null && typeof note !== "string")) {
    return { error: "That request wasn't valid. Reload the page and try again." };
  }
  const address = consentEmail(email);
  const cleanNote = (note ?? "").trim();
  if (!address || address.length > 320) {
    return { error: "That email address isn't valid." };
  }
  if (cleanNote.length > NOTE_MAX) {
    return { error: `Keep the note under ${NOTE_MAX} characters.` };
  }

  const supabase = await createClient();

  // Only unsubscribe someone who is on the list now. This also gives the
  // new row their name, so the log reads clearly.
  const { data: current, error: findError } = await supabase
    .from("marketing_subscribers")
    .select("name")
    .eq("email", address)
    .maybeSingle();
  if (findError) {
    console.error("Unsubscribe: checking the list failed:", findError.message);
    return { error: "The list didn't load. Reload the page and try again." };
  }
  if (!current) {
    revalidatePath("/admin/marketing");
    return { error: "That person isn't on the list any more. Reload the page." };
  }

  const { error } = await supabase.from("marketing_consent_events").insert({
    email: address,
    name: current.name ?? null,
    action: "opt_out",
    source: "admin",
    recorded_by: user.email ?? user.id,
    note: cleanNote || null,
  });
  if (error) {
    console.error("Unsubscribe: saving failed:", error.message);
    return { error: "The unsubscribe didn't save. Reload the page and try again." };
  }

  revalidatePath("/admin/marketing");
  return {};
}
