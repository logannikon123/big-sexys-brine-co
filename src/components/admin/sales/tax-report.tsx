import Link from "next/link";
import { Download } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { kindLabel } from "@/lib/food-tax-rates";
import { denverDateString } from "@/lib/admin/sales-stats";
import type {
  TaxReport,
  TaxReportGroup,
  TaxReportNote,
  TaxTextLine,
} from "@/lib/admin/tax-report";
import {
  lastMonth,
  lastQuarter,
  periodChoices,
  periodDates,
  periodLabel,
  periodQuery,
  periodValue,
  samePeriod,
  thisMonth,
  thisQuarter,
  type TaxPeriod,
} from "@/lib/admin/tax-report-filters";

const PATH = "/admin/sales/tax";

const PILL =
  "flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors";
const PILL_ON = "border-brand-orange bg-brand-orange/15 text-brand-orange";
const PILL_OFF = "border-border text-muted-foreground hover:bg-muted hover:text-foreground";
const FIELD = "h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";
const BUTTON =
  "flex h-11 shrink-0 items-center rounded-full border border-brand-orange bg-brand-orange px-4 text-sm font-medium text-white hover:bg-brand-orange/90";

function percent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function orders(count: number): string {
  return count === 1 ? "1 order" : `${count} orders`;
}

/* ---------- Picking the dates ---------- */

/** Quick choices, a month or quarter picker and a custom range. No browser code. */
export function TaxPeriodPicker({ period }: { period: TaxPeriod }) {
  const quick: { label: string; period: TaxPeriod }[] = [
    { label: "Last month", period: lastMonth() },
    { label: "This month", period: thisMonth() },
    { label: "Last quarter", period: lastQuarter() },
    { label: "This quarter", period: thisQuarter() },
  ];
  const { months, quarters } = periodChoices();
  const today = denverDateString(new Date().toISOString());
  const custom = period.type === "custom";
  const dates = periodDates(period);

  return (
    <div className="space-y-3">
      <nav aria-label="Quick dates" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {quick.map((q) => {
          const on = samePeriod(q.period, period);
          return (
            <Link
              key={q.label}
              href={`${PATH}${periodQuery(q.period)}`}
              aria-current={on ? "page" : undefined}
              className={cn(PILL, on ? PILL_ON : PILL_OFF)}
            >
              {q.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap gap-3">
        <form
          method="get"
          action={PATH}
          aria-label="Pick a month or quarter"
          className={cn(
            "flex flex-wrap items-end gap-3 rounded-lg border p-3",
            custom ? "border-border" : "border-brand-orange"
          )}
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Month or quarter
            <select
              name="period"
              defaultValue={custom ? periodValue(months[1]) : periodValue(period)}
              className={FIELD}
            >
              <optgroup label="Quarters">
                {quarters.map((q) => (
                  <option key={periodValue(q)} value={periodValue(q)}>
                    {periodLabel(q)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Months">
                {months.map((m) => (
                  <option key={periodValue(m)} value={periodValue(m)}>
                    {periodLabel(m)}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <button type="submit" className={BUTTON}>
            Show
          </button>
        </form>

        <form
          method="get"
          action={PATH}
          aria-label="Custom dates"
          className={cn(
            "flex flex-wrap items-end gap-3 rounded-lg border p-3",
            custom ? "border-brand-orange" : "border-border"
          )}
        >
          <input type="hidden" name="period" value="custom" />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            From
            <input
              type="date"
              name="from"
              required
              max={today}
              defaultValue={dates.from}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            To
            <input
              type="date"
              name="to"
              required
              defaultValue={dates.to}
              className={FIELD}
            />
          </label>
          <button type="submit" className={BUTTON}>
            Apply
          </button>
        </form>
      </div>
    </div>
  );
}

export function TaxCsvLink({ period }: { period: TaxPeriod }) {
  return (
    <a
      href={`${PATH}/export${periodQuery(period)}`}
      download
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
    >
      <Download className="h-4 w-4" />
      Download CSV
    </a>
  );
}

/* ---------- The report ---------- */

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

function PlaceTable({
  id,
  title,
  description,
  group,
  empty,
}: {
  id: string;
  title: string;
  description: string;
  group: TaxReportGroup;
  empty: string;
}) {
  return (
    <Card id={id} className="scroll-mt-6 gap-4">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="px-0 sm:px-2">
        {group.lines.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table className="min-w-[40rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Place</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Collected by</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Taxable sales</TableHead>
                <TableHead className="pr-4 text-right">Tax collected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.lines.map((l) => (
                <TableRow key={l.key}>
                  <TableCell className="pl-4">
                    <span className="font-medium">{l.name}</span>
                    {l.censusGeoid && (
                      <span className="block text-xs text-muted-foreground">
                        Census code {l.censusGeoid}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{kindLabel(l.kind)}</TableCell>
                  <TableCell>
                    {l.collectedBy === "state" ? "State" : l.collectedBy === "self" ? "City" : "None"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{percent(l.rateBps)}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.orders}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(l.taxableCents)}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {formatPrice(l.taxCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4 font-medium" colSpan={6}>
                  Total tax
                </TableCell>
                <TableCell className="pr-4 text-right font-bold tabular-nums">
                  {formatPrice(group.taxCents)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TextLineTable({ lines, showTax }: { lines: TaxTextLine[]; showTax: boolean }) {
  return (
    <Table className="min-w-[32rem]">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Saved place</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className={cn("text-right", !showTax && "pr-4")}>Jar sales</TableHead>
          {showTax && <TableHead className="pr-4 text-right">Tax collected</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <TableRow key={l.key}>
            <TableCell className="pl-4 font-medium">{l.jurisdiction}</TableCell>
            <TableCell className="text-right tabular-nums">
              {l.rateBps === null ? "None on file" : percent(l.rateBps)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{l.orders}</TableCell>
            <TableCell className={cn("text-right tabular-nums", !showTax && "pr-4")}>
              {formatPrice(l.jarSalesCents)}
            </TableCell>
            {showTax && (
              <TableCell className="pr-4 text-right tabular-nums">{formatPrice(l.taxCents)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function NoteLine({ label, note, after }: { label: string; note: TaxReportNote; after: string }) {
  if (note.orders === 0) return null;
  return (
    <li>
      <span className="font-medium text-foreground">{label}:</span> {orders(note.orders)} (#
      {note.orderNumbers.join(", #")}), {formatPrice(note.jarSalesCents)} of jars and{" "}
      {formatPrice(note.taxCents)} of tax. {after}
    </li>
  );
}

export function TaxReportView({ report, period }: { report: TaxReport; period: TaxPeriod }) {
  const nothing = report.orders === 0;
  return (
    <div className="space-y-6">
      {!report.partsAvailable && (
        <Card className="border-brand-orange">
          <CardContent className="py-4 text-sm">
            <p className="font-medium">Tax details start with orders placed after this update.</p>
            <p className="mt-1 text-muted-foreground">
              The database doesn&apos;t have the tax split yet, so every order shows in the
              &quot;orders before the tax split&quot; line below, by the place saved on it.
            </p>
          </CardContent>
        </Card>
      )}

      {report.splitMismatches.length > 0 && (
        <Card className="border-red-400">
          <CardContent className="py-4 text-sm text-red-300">
            The city and county split for order #{report.splitMismatches.join(", #")} doesn&apos;t
            add up to the tax charged. Tell Nick before you file.
          </CardContent>
        </Card>
      )}

      <section aria-label={`Totals, ${periodLabel(period)}`} className="grid gap-3 sm:grid-cols-3">
        <Tile label="Orders" value={String(report.orders)} note="Paid in these dates." />
        <Tile
          label="Jar sales"
          value={formatPrice(report.jarSalesCents)}
          note="Jar prices only. Fees and tax aren't in this number."
        />
        <Tile
          label="Local tax collected"
          value={formatPrice(report.taxCents)}
          note="City and county tax on food, from every order."
        />
      </section>

      {nothing ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No paid orders in {periodLabel(period)}.
          </CardContent>
        </Card>
      ) : (
        <>
          <PlaceTable
            id="state"
            title="State return (state-collected)"
            description="The Colorado Department of Revenue collects the tax for these counties and towns. They go on the state sales tax return, in Revenue Online or SUTS, one line for each place."
            group={report.state}
            empty="No state-collected tax in these dates."
          />
          <PlaceTable
            id="cities"
            title="City returns (self-collected, file in SUTS)"
            description="These home-rule cities collect their own tax. Each one gets its own return, filed in SUTS."
            group={report.self}
            empty="No self-collected city tax in these dates."
          />
          {report.none.lines.length > 0 && (
            <PlaceTable
              id="no-tax"
              title="Places with no local sales tax"
              description="Orders went to these places, but they have no sales tax, so there is nothing to file for them."
              group={report.none}
              empty=""
            />
          )}

          {report.beforeSplit.orders > 0 && (
            <Card id="before-split" className="scroll-mt-6 gap-4">
              <CardHeader>
                <CardTitle className="text-lg">
                  Orders before the tax split (city and county not recorded)
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {orders(report.beforeSplit.orders)}, {formatPrice(report.beforeSplit.taxCents)} of
                  tax. These orders saved only one combined rate and the place as text, so the
                  report can&apos;t split them between city and county. The place below is what
                  checkout saved, city first and county second.
                </p>
              </CardHeader>
              <CardContent className="px-0 sm:px-2">
                <TextLineTable lines={report.beforeSplit.lines} showTax />
              </CardContent>
            </Card>
          )}

          <Card id="no-rate" className="scroll-mt-6 gap-4">
            <CardHeader>
              <CardTitle className="text-lg">Paid 0% because no rate was on file</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.noRate.orders === 0
                  ? "None in these dates."
                  : `${orders(report.noRate.orders)}, ${formatPrice(report.noRate.jarSalesCents)} of jars. Checkout had no confirmed rate for these places, so it charged no local tax.`}
              </p>
            </CardHeader>
            {report.noRate.orders > 0 && (
              <CardContent className="px-0 sm:px-2">
                <TextLineTable lines={report.noRate.lines} showTax={false} />
              </CardContent>
            )}
          </Card>
        </>
      )}

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-lg">Refunds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {report.partialRefunds.orders +
            report.fullRefunds.orders +
            report.cancelledAfterPayment.orders ===
          0 ? (
            <p>No refunds or cancellations on orders paid in these dates.</p>
          ) : (
            <ul className="list-disc space-y-2 pl-5">
              <NoteLine
                label="Refunded in full"
                note={report.fullRefunds}
                after="Left out of the numbers above."
              />
              <NoteLine
                label="Cancelled after payment"
                note={report.cancelledAfterPayment}
                after="Left out of the numbers above. Check in Square that the money went back."
              />
              {report.partialRefunds.orders > 0 && (
                <li>
                  <span className="font-medium text-foreground">Partly refunded:</span>{" "}
                  {orders(report.partialRefunds.orders)} (#
                  {report.partialRefunds.orderNumbers.join(", #")}),{" "}
                  {formatPrice(report.partialRefunds.refundedCents)} given back. Still counted in
                  full above, because the site doesn&apos;t yet record how much of a partial refund
                  was tax.
                </li>
              )}
            </ul>
          )}
          <p>
            Refunds are counted against the order&apos;s paid date, not the day of the refund.
          </p>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-lg">Which numbers go where</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Each line is one place: a city or a county. An order shows on two lines when it went to
            a city, once for the city and once for its county, so the taxable sales on the lines
            add up to more than the jar sales.
          </p>
          <p>
            <span className="font-medium text-foreground">State return:</span> every line in
            &quot;State return (state-collected)&quot;. Put each place&apos;s taxable sales and tax
            on that place&apos;s line.
          </p>
          <p>
            <span className="font-medium text-foreground">City returns:</span> each line in
            &quot;City returns (self-collected)&quot; is a return of its own, filed in SUTS.
          </p>
          <p>
            Taxable sales are jar prices only, because checkout charged tax on the jars and not on
            delivery, rush, packing or postage. The Sales page has the full totals with fees. A
            place shows on two lines if its rate changed during the dates.
          </p>
          <p>
            Checkout charges only city and county tax on food, so state, RTD and SCFD tax
            don&apos;t appear here. If a return asks for anything this page doesn&apos;t show, ask
            the accountant.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
