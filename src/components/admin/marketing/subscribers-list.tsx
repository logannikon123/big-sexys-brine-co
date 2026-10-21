import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MarketingSubscriber } from "@/app/admin/marketing/marketing-data";
import { formatConsentTime, sourceLabel } from "./marketing-format";
import { UnsubscribeButton } from "./unsubscribe-button";

/** Everyone on the list: cards on phones, a table on wider screens. */
export function SubscribersList({ rows }: { rows: MarketingSubscriber[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No one is on the list yet. When a customer ticks the marketing box at
          checkout or on the contest form, they show up here.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.email} className="rounded-xl border border-border bg-card p-4">
            <p className="break-all font-medium">{row.email}</p>
            {row.name && <p className="text-sm">{row.name}</p>}
            <p className="mt-2 text-sm text-muted-foreground">
              From {sourceLabel(row.source)}, {formatConsentTime(row.opted_in_at)}
            </p>
            <UnsubscribeButton email={row.email} name={row.name} className="mt-3 h-11 w-full" />
          </li>
        ))}
      </ul>

      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Signed up from</TableHead>
              <TableHead>Opted in at (Colorado time)</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.email}>
                <TableCell className="pl-4 font-medium">{row.email}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{sourceLabel(row.source)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatConsentTime(row.opted_in_at)}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <UnsubscribeButton email={row.email} name={row.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
