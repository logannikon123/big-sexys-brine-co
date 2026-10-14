import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/is-admin";
import { redirect } from "next/navigation";

/**
 * Require a signed-in admin. Anyone else is sent to the admin login page.
 * Use this in server components and server actions to enforce auth.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user)) {
    redirect("/admin/login");
  }

  return user;
}

/**
 * Require a signed-in admin for server actions.
 * Throws an error instead of redirecting (since server actions can't redirect mid-execution).
 */
export async function requireAuthAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized: You must be logged in to perform this action.");
  }

  if (!isAdmin(user)) {
    throw new Error("Unauthorized: This account does not have admin access.");
  }

  return user;
}
