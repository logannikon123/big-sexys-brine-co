import type { User } from "@supabase/supabase-js";

/**
 * True only for accounts tagged as admins (app_metadata.role = "admin").
 * Only the Supabase dashboard or the service role key can change
 * app_metadata, so a user can't give themselves the tag.
 */
export function isAdmin(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === "admin";
}
