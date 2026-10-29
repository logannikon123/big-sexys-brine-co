"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { classWhen } from "@/lib/classes/format";
import {
  deleteClassSession,
  setClassSessionPublished,
} from "@/app/admin/classes/actions";
import {
  STATUS_BADGE_CLASS,
  REFUND_BADGE_CLASS,
  formatOrderTime,
  refundLabel,
} from "@/components/admin/orders/order-flow";
import { SandboxBadge } from "@/components/admin/orders/order-badges";
import { ClassSessionForm } from "./class-session-form";
import { CancelBookingButton } from "./cancel-booking-button";
import {
  bookingStatusLabel,
  holdsSeats,
  seatWords,
  type AdminClassBooking,
  type AdminClassSession,
} from "./class-rows";

interface ClassSessionCardProps {
  session: AdminClassSession;
  defaultPriceCents: number;
  /** True for a class that is over. */
  past?: boolean;
}

function SeatsLine({ session }: { session: AdminClassSession }) {
  const left = session.seats - session.seatsTaken;
  return (
    <p className="text-sm">
      {seatWords(session.seats)}: {session.seatsTaken} taken,{" "}
      {left >= 0 ? (
        <span className={left === 0 ? "font-medium text-amber-300" : undefined}>
          {left === 0 ? "full" : `${left} left`}
        </span>
      ) : (
        <span className="font-medium text-red-300">
          {seatWords(-left)} over
        </span>
      )}
    </p>
  );
}

function BookingRow({
  booking,
  startsAt,
}: {
  booking: AdminClassBooking;
  startsAt: string;
}) {
  const order = booking.order;
  const cancelled = booking.cancelled_at !== null;
  const refund = order ? refundLabel(order.refund_status) : null;
  const counts = holdsSeats(booking);

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        {order ? (
          <Link
            href={`/admin/orders/${order.id}`}
            className="font-medium text-brand-orange underline underline-offset-4"
          >
            Order #{order.order_number}
          </Link>
        ) : (
          <span className="font-medium">Order not found</span>
        )}
        <span className="text-sm">{seatWords(booking.seats)}</span>
        {order && (
          <Badge variant="outline" className={cn("text-xs", STATUS_BADGE_CLASS[order.status])}>
            {bookingStatusLabel(order.status)}
          </Badge>
        )}
        {refund && (
          <Badge variant="outline" className={cn("text-xs", REFUND_BADGE_CLASS)}>
            {refund}
          </Badge>
        )}
        {cancelled && (
          <Badge variant="outline" className="border-zinc-500/50 bg-zinc-500/15 text-xs text-zinc-300">
            Booking cancelled
          </Badge>
        )}
        {order?.square_environment === "sandbox" && <SandboxBadge />}
        {!cancelled && !counts && (
          <span className="text-xs text-muted-foreground">Holds no seats</span>
        )}
      </div>

      {order && (
        <div className="text-sm">
          <p>{order.customer_name}</p>
          <div className="flex flex-wrap gap-x-4">
            <a
              href={`mailto:${order.customer_email}`}
              className="inline-flex min-h-11 items-center gap-2 break-all text-brand-orange underline underline-offset-4"
            >
              <Mail className="h-4 w-4 shrink-0" />
              {order.customer_email}
            </a>
            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex min-h-11 items-center gap-2 text-brand-orange underline underline-offset-4"
              >
                <Phone className="h-4 w-4 shrink-0" />
                {order.customer_phone}
              </a>
            )}
          </div>
        </div>
      )}

      {cancelled ? (
        <div className="text-xs text-muted-foreground">
          <p>Cancelled {formatOrderTime(booking.cancelled_at)}</p>
          {booking.cancel_note && (
            <p className="mt-1 whitespace-pre-line">Note: {booking.cancel_note}</p>
          )}
        </div>
      ) : (
        <CancelBookingButton booking={booking} startsAt={startsAt} />
      )}
    </li>
  );
}

/** One class date: its details, buttons, and the people booked on it. */
export function ClassSessionCard({ session, defaultPriceCents, past = false }: ClassSessionCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const hasBookings = session.bookings.length > 0;

  function run(action: () => Promise<{ error?: string; message?: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) toast.error(result.error);
        else toast.success(result.message ?? "Saved");
      } catch {
        toast.error("Something went wrong and nothing was saved. Check your connection and try again.");
      } finally {
        setConfirmDelete(false);
      }
    });
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">{classWhen(session.starts_at, session.ends_at)}</CardTitle>
          {/* A class that is over drops off the site whatever the switch says. */}
          {past ? null : session.is_published ? (
            <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/15 text-xs text-emerald-300">
              Shown on site
            </Badge>
          ) : (
            <Badge variant="outline" className="border-zinc-500/50 bg-zinc-500/15 text-xs text-zinc-300">
              Hidden
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <div className="space-y-1 text-sm">
          <p className="inline-flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {session.location_name}
              {session.location_address && (
                <span className="text-muted-foreground">, {session.location_address}</span>
              )}
            </span>
          </p>
          <p>{formatPrice(session.price_cents)} a seat</p>
          <SeatsLine session={session} />
        </div>

        {editing ? (
          <div className="rounded-md border border-border p-4">
            <ClassSessionForm
              session={session}
              defaultPriceCents={defaultPriceCents}
              onDone={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            {!past && (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={pending}
                onClick={() => run(() => setClassSessionPublished(session.id, !session.is_published))}
              >
                {session.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {session.is_published ? "Hide" : "Show"}
              </Button>
            )}
            {!hasBookings && (
              <Button
                type="button"
                variant="outline"
                className="h-11 text-red-300 hover:text-red-200"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        )}
        {hasBookings && !editing && !past && (
          <p className="text-xs text-muted-foreground">
            A class date with bookings can&apos;t be deleted. To call it off,
            hide it and cancel each booking.
          </p>
        )}

        <div className="border-t border-border pt-4">
          <p className="mb-3 font-medium">
            Bookings{hasBookings ? ` (${session.bookings.length})` : ""}
          </p>
          {hasBookings ? (
            <ul className="divide-y divide-border">
              {session.bookings.map((booking) => (
                <BookingRow key={booking.id} booking={booking} startsAt={session.starts_at} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this class date?</AlertDialogTitle>
          <AlertDialogDescription>
            {classWhen(session.starts_at, session.ends_at)} at {session.location_name}.
            Nobody has booked it. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11" onClick={() => setConfirmDelete(false)}>
            Keep it
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={() => run(() => deleteClassSession(session.id))}
          >
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </Card>
  );
}
