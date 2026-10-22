/**
 * The tax report as a CSV file for a spreadsheet. Server code only.
 */

import "server-only";
import { kindLabel } from "@/lib/food-tax-rates";
import { toCsv } from "./sales-csv";
import type { TaxReport, TaxReportLine, TaxTextLine } from "./tax-report";

type Cell = string | number | null;

/** 1234 cents -> "12.34", a plain number a spreadsheet can add up. */
function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 350 -> "3.50" (percent). */
export function percent(bps: number): string {
  return (bps / 100).toFixed(2);
}

export function collectorName(collectedBy: TaxReportLine["collectedBy"]): string {
  return collectedBy === "state" ? "State" : collectedBy === "self" ? "City" : "None";
}

const HEADER: Cell[] = [
  "Section",
  "Place",
  "Kind",
  "Collected by",
  "Census code",
  "Rate (%)",
  "Orders",
  "Taxable jar sales ($)",
  "Tax collected ($)",
  "Refunded jar sales taken off ($)",
  "Refunded tax taken off ($)",
];

function placeRow(section: string, l: TaxReportLine): Cell[] {
  return [
    section,
    l.name,
    kindLabel(l.kind),
    collectorName(l.collectedBy),
    l.censusGeoid,
    percent(l.rateBps),
    l.orders,
    dollars(l.taxableCents),
    dollars(l.taxCents),
    dollars(l.refundTaxableCents),
    dollars(l.refundTaxCents),
  ];
}

function textRow(section: string, l: TaxTextLine): Cell[] {
  return [
    section,
    l.jurisdiction,
    null,
    null,
    null,
    l.rateBps === null ? "none on file" : percent(l.rateBps),
    l.orders,
    dollars(l.jarSalesCents),
    dollars(l.taxCents),
    dollars(l.refundJarsCents),
    dollars(l.refundTaxCents),
  ];
}

function totalRow(section: string, taxCents: number): Cell[] {
  return [section, "Total", null, null, null, null, null, null, dollars(taxCents)];
}

export function taxReportCsv(report: TaxReport, periodLabel: string): string {
  const STATE = "State return (state-collected)";
  const CITY = "City returns (self-collected, file in SUTS)";
  const NONE = "No local sales tax";
  const BEFORE = "Orders before the tax split (city and county not recorded)";
  const NO_RATE = "Paid 0% (no rate on file)";

  const rows: Cell[][] = [
    ["Local food tax report", periodLabel],
    ["Paid orders through Square's live system, by the day they were paid (Colorado time)."],
    ["Taxable jar sales are jar prices only. Fees were not taxed."],
    [
      report.refundTiming === "paid"
        ? "Refunds count with their order's paid date. Sales and tax are less the refunds whose split is known."
        : "Refunds count in the dates they were made (Colorado time). Sales and tax are less the refunds whose split is known.",
    ],
    [],
    HEADER,
    ...report.state.lines.map((l) => placeRow(STATE, l)),
    totalRow(STATE, report.state.taxCents),
    ...report.self.lines.map((l) => placeRow(CITY, l)),
    totalRow(CITY, report.self.taxCents),
  ];
  if (report.none.lines.length > 0) rows.push(...report.none.lines.map((l) => placeRow(NONE, l)));
  if (report.beforeSplit.orders > 0) {
    rows.push(...report.beforeSplit.lines.map((l) => textRow(BEFORE, l)));
    rows.push(totalRow(BEFORE, report.beforeSplit.taxCents));
  }
  if (report.noRate.orders > 0) rows.push(...report.noRate.lines.map((l) => textRow(NO_RATE, l)));

  rows.push(
    [],
    [
      "All orders",
      null,
      null,
      null,
      null,
      null,
      report.orders,
      dollars(report.jarSalesCents),
      dollars(report.taxCents),
      dollars(report.refundsTaken.jarsCents),
      dollars(report.refundsTaken.taxCents),
    ],
    [],
    ["Notes", "Orders", "Jar sales ($)", "Tax on those orders ($)", "Money refunded ($)", "Order numbers"]
  );
  const note = (label: string, n: TaxReport["fullRefunds"]) =>
    rows.push([
      label,
      n.orders,
      dollars(n.jarSalesCents),
      dollars(n.taxCents),
      dollars(n.refundedCents),
      n.orderNumbers.join(" "),
    ]);
  const where = report.refundTiming === "paid" ? "left out above" : "counted as sales above";
  note("Refunds with no split (still counted in full above)", report.unsplitRefunds);
  note(`Refunded in full (${where})`, report.fullRefunds);
  note(`Cancelled after payment (${where})`, report.cancelledAfterPayment);
  if (report.splitMismatches.length > 0) {
    rows.push(["Split doesn't match the order's tax", report.splitMismatches.join(" ")]);
  }
  return toCsv(rows);
}
