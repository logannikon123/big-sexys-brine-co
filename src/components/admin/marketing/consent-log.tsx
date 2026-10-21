import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ConsentEvent } from "@/app/admin/marketing/marketing-data";
import { actionLabel, formatConsentTime, sourceLabel } from "./marketing-format";

function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        action === "opt_in"
          ? "bg-green-500/15 text-green-700 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {actionLabel(action)}
    </span>
  );
}

function OrderLink({ row }: { row: ConsentEvent }) {
  if (!row.order_id) return null;
  return (
    <Link
      href={`/admin/orders/${row.order_id}`}
      className="text-brand-orange underline-offset-2 hover:underline"
    >
      {row.order_number != null ? `#${row.order_number}` : "Open order"}
    </Link>
  );
}

/** One label and value on a phone card. Empty values are left out. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

/** Every row of the consent log, newest first. */
export function ConsentLog({ rows }: { rows: ConsentEvent[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          The consent log is empty.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-all font-medium">{row.email}</p>
              <ActionBadge action={row.action} />
            </div>
            <dl className="mt-3 space-y-2">
              <Field label="When (Colorado time)">{formatConsentTime(row.created_at)}</Field>
              <Field label="Name">{row.name}</Field>
              <Field label="Source">{sourceLabel(row.source)}</Field>
              <Field label="Consent version">{row.consent_version}</Field>
              <Field label="Exact wording they agreed to">{row.consent_text}</Field>
              <Field label="IP address">{row.ip_address}</Field>
              <Field label="Browser">
                {row.user_agent && <span className="break-all text-xs">{row.user_agent}</span>}
              </Field>
              <Field label="Order">{row.order_id && <OrderLink row={row} />}</Field>
              <Field label="Contest entry">{row.contest_entry_id}</Field>
              <Field label="Recorded by">{row.recorded_by}</Field>
              <Field label="Note">{row.note}</Field>
            </dl>
          </li>
        ))}
      </ul>

      <Card className="hidden py-0 md:block">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">When (Colorado time)</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Exact wording</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>Browser</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Contest entry</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead className="pr-4">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell className="whitespace-nowrap pl-4 align-top">
                  {formatConsentTime(row.created_at)}
                </TableCell>
                <TableCell className="whitespace-nowrap align-top font-medium">
                  {row.email}
                </TableCell>
                <TableCell className="whitespace-nowrap align-top">{row.name}</TableCell>
                <TableCell className="align-top">
                  <ActionBadge action={row.action} />
                </TableCell>
                <TableCell className="align-top">{sourceLabel(row.source)}</TableCell>
                <TableCell className="whitespace-nowrap align-top">{row.consent_version}</TableCell>
                <TableCell className="min-w-64 max-w-sm align-top">{row.consent_text}</TableCell>
                <TableCell className="whitespace-nowrap align-top font-mono">
                  {row.ip_address}
                </TableCell>
                <TableCell className="min-w-56 max-w-xs break-all align-top text-muted-foreground">
                  {row.user_agent}
                </TableCell>
                <TableCell className="whitespace-nowrap align-top">
                  <OrderLink row={row} />
                </TableCell>
                <TableCell className="align-top">{row.contest_entry_id}</TableCell>
                <TableCell className="whitespace-nowrap align-top">{row.recorded_by}</TableCell>
                <TableCell className="min-w-40 max-w-xs pr-4 align-top">{row.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
