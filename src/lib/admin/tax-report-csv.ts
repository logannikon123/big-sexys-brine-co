/**
 * The tax report as a CSV file for a spreadsheet. Server code only.
 *
 * It reads top to bottom like the report page: a summary, then one table
 * for each kind of return, each with its own heading row and total. Sections
 * with nothing in them say so in a sentence instead of showing empty rows,
 * and the refund notes are sentences too.
 */

import "server-only";
import { kindLabel } from "@/lib/food-tax-rates";
import { toCsv } from "./sales-csv";
import {
  emptyReason,
  type TaxReport,
  type TaxReportGroup,
  type TaxReportNote,
  type TaxTextLine,
} from "./tax-report";

type Cell = string | number | null;
type Row = Cell[];

/**
 * 1234 cents -> "12.34", which a spreadsheet reads as a number. A minus
 * amount goes out as a plain number, because text that starts with a minus
 * sign gets marked as text for safety (see csvCell).
 */
function dollars(cents: number): string | number {
  return cents < 0 ? cents / 100 : (cents / 100).toFixed(2);
}

/** 1234 cents -> "$12.34", for sentences. */
function money(cents: number): string {
  const text = `$${(Math.abs(cents) / 100).toFixed(2)}`;
  return cents < 0 ? `minus ${text}` : text;
}

/** 350 -> "3.50" (percent). */
function percent(bps: number): string {
  return (bps / 100).toFixed(2);
}

function orders(count: number): string {
  return count === 1 ? "1 order" : `${count} orders`;
}

function numbers(list: number[]): string {
  return list.map((n) => `#${n}`).join(", ");
}

/** A table of places: heading, one row per place, then a total. */
function placeTable(group: TaxReportGroup, withRefunds: boolean, empty: string): Row[] {
  if (group.lines.length === 0) return [[empty]];
  const header: Row = ["Place", "Kind", "Rate (%)", "Orders", "Taxable sales ($)", "Tax ($)"];
  if (withRefunds) header.push("Refunded sales already taken off ($)", "Refunded tax already taken off ($)");
  header.push("Census code");

  const rows: Row[] = [header];
  for (const l of group.lines) {
    const row: Row = [
      l.name,
      kindLabel(l.kind),
      percent(l.rateBps),
      l.orders,
      dollars(l.taxableCents),
      dollars(l.taxCents),
    ];
    if (withRefunds) row.push(dollars(l.refundTaxableCents), dollars(l.refundTaxCents));
    row.push(l.censusGeoid);
    rows.push(row);
  }
  rows.push([
    "Total",
    null,
    null,
    null,
    dollars(group.lines.reduce((sum, l) => sum + l.taxableCents, 0)),
    dollars(group.taxCents),
  ]);
  return rows;
}

/** A table of orders grouped by the place text saved on them. */
function textTable(lines: TaxTextLine[], showTax: boolean): Row[] {
  const header: Row = ["Saved place", "Rate (%)", "Orders", "Jar sales ($)"];
  if (showTax) header.push("Tax ($)");
  return [
    header,
    ...lines.map((l) => {
      const row: Row = [
        l.jurisdiction,
        l.rateBps === null ? "none on file" : percent(l.rateBps),
        l.orders,
        dollars(l.jarSalesCents),
      ];
      if (showTax) row.push(dollars(l.taxCents));
      return row;
    }),
  ];
}

function noteSentence(label: string, note: TaxReportNote, after: string): Row[] {
  if (note.orders === 0) return [];
  return [
    [
      `${label}: ${orders(note.orders)} (${numbers(note.orderNumbers)}), ${money(note.jarSalesCents)} of jars and ${money(note.taxCents)} of tax. ${after}`,
    ],
  ];
}

export function taxReportCsv(report: TaxReport, periodLabel: string, madeOn?: string): string {
  const byPaid = report.refundTiming === "paid";
  const taken = report.refundsTaken;
  const withRefunds = taken.refunds > 0;
  const nothing = report.orders === 0 && taken.refunds === 0;

  const rows: Row[] = [
    [`Big Sexy's Brine Co: local food tax, ${periodLabel}`],
    [
      `Orders paid through Square's live system, by the day they were paid (Colorado time).${madeOn ? ` Downloaded ${madeOn}.` : ""}`,
    ],
    [],
    ["SUMMARY"],
    ["Orders paid", report.orders],
    ["Jar sales ($)", dollars(report.jarSalesCents)],
    ["Local tax collected ($)", dollars(report.taxCents)],
  ];
  if (withRefunds) {
    rows.push(
      ["Refunded jars already taken off ($)", dollars(taken.jarsCents)],
      ["Refunded tax already taken off ($)", dollars(taken.taxCents)]
    );
  }
  if (report.splitMismatches.length > 0) {
    rows.push([
      `WARNING: the city and county split for ${numbers(report.splitMismatches)} doesn't add up to the tax charged. Tell Nick before you file.`,
    ]);
  }

  if (nothing) {
    rows.push([], [`${emptyReason(report)}${report.fullRefunds.orders + report.cancelledAfterPayment.orders > 0 ? " See REFUNDS below." : ""}`]);
  } else {
    rows.push(
      [],
      ["STATE RETURN: the Colorado Department of Revenue collects for these places. One line each on the state return."],
      ...placeTable(report.state, withRefunds, "No state-collected tax in these dates."),
      [],
      ["CITY RETURNS: these cities collect their own tax. Each one is its own return, filed in SUTS."],
      ...placeTable(report.self, withRefunds, "No self-collected city tax in these dates.")
    );
    if (report.none.lines.length > 0) {
      rows.push(
        [],
        ["NO LOCAL SALES TAX: orders went to these places, but there is nothing to file for them."],
        ...placeTable(report.none, withRefunds, "")
      );
    }
    if (report.beforeSplit.lines.length > 0) {
      rows.push(
        [],
        ["ORDERS BEFORE THE TAX SPLIT: only one combined rate was saved, so these can't be split between city and county. The place is city first, county second."],
        ...textTable(report.beforeSplit.lines, true)
      );
    }
    if (report.noRate.lines.length > 0) {
      rows.push(
        [],
        ["PAID 0%: checkout had no confirmed rate for these places, so it charged no local tax."],
        ...textTable(report.noRate.lines, false)
      );
    }
  }

  const unsplit = report.unsplitRefunds;
  const refundRows: Row[] = [];
  if (withRefunds) {
    refundRows.push([
      `Already taken off the numbers above: ${taken.refunds === 1 ? "1 refund" : `${taken.refunds} refunds`} (${numbers(taken.orderNumbers)}), ${money(taken.jarsCents)} of jars and ${money(taken.taxCents)} of tax.`,
    ]);
  }
  if (unsplit.orders > 0) {
    refundRows.push([
      `To check: ${orders(unsplit.orders)} (${numbers(unsplit.orderNumbers)}) with ${money(unsplit.refundedCents)} refunded where nobody said what the refund was for. Still counted in full above. Answer it on the order page.`,
    ]);
  }
  refundRows.push(
    ...noteSentence(
      "Refunded in full",
      report.fullRefunds,
      byPaid ? "Left out of the numbers above." : "Counted as sales above; the refunds come off in the month they were made."
    ),
    ...noteSentence(
      "Cancelled after payment",
      report.cancelledAfterPayment,
      byPaid
        ? "Left out of the numbers above. Check in Square that the money went back."
        : "Counted as sales above; the refunds come off in the month they were made."
    )
  );
  if (refundRows.length > 0) rows.push([], ["REFUNDS"], ...refundRows);

  rows.push(
    [],
    ["NOTES"],
    [
      byPaid
        ? "Refunds count in the month the order was paid."
        : "Refunds count in the month they were made.",
    ],
    ["Taxable sales are jar prices only. Delivery, rush, packing and postage were not taxed."],
    ["An order to a city shows twice: once for the city and once for its county."]
  );
  return toCsv(rows);
}
