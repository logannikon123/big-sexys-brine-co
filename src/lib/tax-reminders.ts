/**
 * Reminders to check the food tax table before Colorado's tax rates change.
 *
 * Colorado's local sales tax rates change only on January 1 and July 1. The
 * Department of Revenue posts the coming changes about a month before, and
 * cities vote on new taxes each November. On each date below, a daily job
 * (src/app/api/cron/tax-rate-reminder/route.ts) sends Jesse an urgent phone
 * alert and email telling him what to check in Admin, Tax rates.
 *
 * Dates are Colorado calendar dates. Safe to use anywhere: no secrets here.
 */

export interface TaxReminder {
  /** A short name for the reminder, like "election". */
  kind: string;
  title: string;
  /** Plain text, one line per item. */
  lines: string[];
}

const CHANGES_PAGE = "https://tax.colorado.gov/sales-tax-rate-changes";
const RATES_PAGE = "https://tax.colorado.gov/DR1002";
const LOOKUP_PAGE = "https://salestaxlookup.colorado.gov/";

const CHECK_STEPS = [
  `1. Open the state's list of rate changes: ${CHANGES_PAGE}`,
  "2. Look for any county or city in the food tax table, and any new city we deliver or ship to.",
  "3. Update each changed rate in Admin, Tax rates, and mark it confirmed.",
  `Full rate report: ${RATES_PAGE}`,
  `Check one address: ${LOOKUP_PAGE}`,
];

/** Month-day ("MM-DD") to the reminder sent that day, every year. */
const YEARLY: Record<string, (year: number) => TaxReminder> = {
  "11-10": (year) => ({
    kind: "election",
    title: "Tax check: new local taxes may have passed",
    lines: [
      `Colorado's ${year} election is over. Cities and counties may have voted in new sales taxes, which usually start January 1.`,
      "Look up the results for each city and county in the food tax table that taxes food.",
      "The state lists the January changes in early December, and you'll get another reminder then.",
    ],
  }),
  "12-01": (year) => ({
    kind: "january-list",
    title: `Tax check: January 1, ${year + 1} rate changes are out`,
    lines: [
      `Colorado tax rates change on January 1, ${year + 1}. The state posts the list of changes about now.`,
      ...CHECK_STEPS,
    ],
  }),
  "12-20": (year) => ({
    kind: "january-deadline",
    title: `URGENT tax check: rates change January 1, ${year + 1}`,
    lines: [
      "New tax rates start in 12 days. If you haven't updated the food tax table yet, do it now.",
      ...CHECK_STEPS,
    ],
  }),
  "01-02": (year) => ({
    kind: "january-in-effect",
    title: `Tax check: new rates started January 1, ${year}`,
    lines: [
      "New tax rates started yesterday. Make sure every change is in the food tax table and marked confirmed.",
      ...CHECK_STEPS,
    ],
  }),
  "06-01": (year) => ({
    kind: "july-list",
    title: `Tax check: July 1, ${year} rate changes are out`,
    lines: [
      `Colorado tax rates change on July 1, ${year}. The state posts the list of changes about now.`,
      ...CHECK_STEPS,
    ],
  }),
  "06-20": (year) => ({
    kind: "july-deadline",
    title: `URGENT tax check: rates change July 1, ${year}`,
    lines: [
      "New tax rates start in 11 days. If you haven't updated the food tax table yet, do it now.",
      ...CHECK_STEPS,
    ],
  }),
  "07-02": (year) => ({
    kind: "july-in-effect",
    title: `Tax check: new rates started July 1, ${year}`,
    lines: [
      "New tax rates started yesterday. Make sure every change is in the food tax table and marked confirmed.",
      ...CHECK_STEPS,
    ],
  }),
};

/** Extra notes for one date only ("YYYY-MM-DD"), added to that day's reminder. */
const ONE_TIME_NOTES: Record<string, string[]> = {
  "2026-11-10": [
    "On the November 3, 2026 ballot: Wheat Ridge asked to raise its sales tax from 3.5% to 4.5%. Wheat Ridge taxes food, so if it passed, change its rate in the table before January 1.",
    "Aurora, Centennial, Lakewood and Sheridan also had sales tax measures. They don't tax food, so their food rate should stay 0%, but check.",
  ],
};

/** The reminder for a Colorado date ("YYYY-MM-DD"), or null when there is none. */
export function taxReminderFor(isoDate: string): TaxReminder | null {
  const match = /^(\d{4})-(\d{2}-\d{2})$/.exec(isoDate);
  if (!match) return null;
  const make = YEARLY[match[2]];
  if (!make) return null;
  const reminder = make(Number(match[1]));
  const extra = ONE_TIME_NOTES[isoDate];
  return extra ? { ...reminder, lines: [...reminder.lines, "", ...extra] } : reminder;
}

/** Every reminder date in a year, for tests and the admin. */
export function reminderDatesIn(year: number): string[] {
  return Object.keys(YEARLY)
    .map((monthDay) => `${year}-${monthDay}`)
    .sort();
}
