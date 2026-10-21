/** Labels and times for the marketing page and its CSV downloads. */

const STORE_TIME_ZONE = "America/Denver";

/** "Oct 19, 2026, 2:05 PM MDT" in Colorado time. */
export function formatConsentTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** Where a row came from, in plain words. */
export function sourceLabel(source: string): string {
  switch (source) {
    case "checkout":
      return "Checkout";
    case "contest":
      return "Contest";
    case "admin":
      return "Admin";
    default:
      return source;
  }
}

/** What the person chose, in plain words. */
export function actionLabel(action: string): string {
  return action === "opt_in" ? "Opted in" : action === "opt_out" ? "Unsubscribed" : action;
}

/** "1 person agreed" or "12 people agreed". */
export function subscriberCountText(count: number): string {
  return count === 1
    ? "1 person agreed to marketing emails."
    : `${count} people agreed to marketing emails.`;
}
