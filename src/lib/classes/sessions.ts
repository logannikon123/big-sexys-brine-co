import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { PublicClassSession } from "@/types/classes";

/**
 * Upcoming class dates for the public pages, with seats left. Reads through
 * upcoming_class_sessions(), which visitors may call: it gives seat counts,
 * never who booked. Not cached, so the seat count is fresh on each visit.
 *
 * Returns null when the database can't be read, so the page can say so
 * instead of "no dates yet".
 */
export async function getUpcomingClassSessions(): Promise<PublicClassSession[] | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    );
    const { data, error } = await supabase.rpc("upcoming_class_sessions");
    if (error) {
      console.error("Class sessions: couldn't read them:", error.message);
      return null;
    }
    return (data ?? []) as PublicClassSession[];
  } catch (error) {
    console.error("Class sessions failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

/** One upcoming session, or null if it isn't on the list (hidden, past or missing). */
export async function getUpcomingClassSession(id: number): Promise<PublicClassSession | null | "error"> {
  const sessions = await getUpcomingClassSessions();
  if (!sessions) return "error";
  return sessions.find((s) => s.id === id) ?? null;
}
