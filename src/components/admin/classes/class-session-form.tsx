"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_SESSION_SEATS } from "@/types/classes";
import {
  createClassSession,
  updateClassSession,
  type ClassSessionInput,
} from "@/app/admin/classes/actions";
import { isoToDenverInputs } from "@/app/admin/classes/class-time";
import {
  ADDRESS_MAX,
  NAME_MAX,
  PRICE_MAX_CENTS,
  PRICE_MIN_CENTS,
  SEATS_MAX,
  SEATS_MIN,
  seatWords,
  type AdminClassSession,
} from "./class-rows";

interface ClassSessionFormProps {
  /** The session to edit. Leave out to add a new one. */
  session?: AdminClassSession;
  /** Price for a new session, in cents (from the Class Info page). */
  defaultPriceCents: number;
  /** Called after a save, and by the Cancel button. */
  onDone?: () => void;
}

/** 12500 becomes "125", 12550 becomes "125.50". */
function centsToDollars(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

function startingValues(session: AdminClassSession | undefined, defaultPriceCents: number) {
  if (!session) {
    return {
      date: "",
      startTime: "",
      endTime: "",
      locationName: "",
      locationAddress: "",
      seats: String(DEFAULT_SESSION_SEATS),
      price: defaultPriceCents > 0 ? centsToDollars(defaultPriceCents) : "",
      isPublished: true,
    };
  }
  const start = isoToDenverInputs(session.starts_at);
  const end = isoToDenverInputs(session.ends_at);
  return {
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    locationName: session.location_name,
    locationAddress: session.location_address ?? "",
    seats: String(session.seats),
    price: centsToDollars(session.price_cents),
    isPublished: session.is_published,
  };
}

/** The add and edit form for one class date. Times are Colorado time. */
export function ClassSessionForm({ session, defaultPriceCents, onDone }: ClassSessionFormProps) {
  const [values, setValues] = useState(() => startingValues(session, defaultPriceCents));
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idPrefix = session ? `session-${session.id}` : "new-session";

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setProblem(null);
  }

  const seats = Number(values.seats);
  const taken = session?.seatsTaken ?? 0;
  const lowered = session !== undefined && Number.isInteger(seats) && seats < taken;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Times are "HH:MM", so comparing the text compares the times.
    if (values.startTime && values.endTime && values.endTime <= values.startTime) {
      setProblem("The end time must be after the start time.");
      return;
    }

    const input: ClassSessionInput = { ...values, seats };
    startTransition(async () => {
      try {
        const result = session
          ? await updateClassSession(session.id, input)
          : await createClassSession(input);
        if (result.error) {
          setProblem(result.error);
          return;
        }
        toast.success(result.message ?? "Saved");
        if (!session) setValues(startingValues(undefined, defaultPriceCents));
        onDone?.();
      } catch {
        setProblem("Something went wrong and nothing was saved. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-date`}>Date</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            className="h-11"
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-start`}>Starts</Label>
          <Input
            id={`${idPrefix}-start`}
            type="time"
            className="h-11"
            value={values.startTime}
            onChange={(e) => set("startTime", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-end`}>Ends</Label>
          <Input
            id={`${idPrefix}-end`}
            type="time"
            className="h-11"
            value={values.endTime}
            onChange={(e) => set("endTime", e.target.value)}
            required
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Colorado time.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-place`}>Place</Label>
          <Input
            id={`${idPrefix}-place`}
            className="h-11"
            value={values.locationName}
            onChange={(e) => set("locationName", e.target.value)}
            maxLength={NAME_MAX}
            placeholder="The Karma House"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-address`}>Address (optional)</Label>
          <Input
            id={`${idPrefix}-address`}
            className="h-11"
            value={values.locationAddress}
            onChange={(e) => set("locationAddress", e.target.value)}
            maxLength={ADDRESS_MAX}
            placeholder="8402 W Colfax Ave, Lakewood"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-seats`}>Seats</Label>
          <Input
            id={`${idPrefix}-seats`}
            type="number"
            inputMode="numeric"
            className="h-11"
            min={SEATS_MIN}
            max={SEATS_MAX}
            step={1}
            value={values.seats}
            onChange={(e) => set("seats", e.target.value)}
            required
          />
          {lowered && (
            <p role="status" className="text-xs text-amber-300">
              {seatWords(taken)} already booked. Saving this won&apos;t cancel
              anyone: the class shows as full, and you may need to cancel a
              booking yourself.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-price`}>Price per seat ($)</Label>
          <Input
            id={`${idPrefix}-price`}
            type="number"
            inputMode="decimal"
            className="h-11"
            min={PRICE_MIN_CENTS / 100}
            max={PRICE_MAX_CENTS / 100}
            step={0.01}
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
            required
          />
          {session && session.bookings.length > 0 && (
            <p className="text-xs text-muted-foreground">
              People who already booked keep the price they paid.
            </p>
          )}
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <Switch
          checked={values.isPublished}
          onCheckedChange={(checked) => set("isPublished", checked)}
          aria-label="Show on the class page"
        />
        <span className="text-sm">
          Show on the class page
          <span className="block text-xs text-muted-foreground">
            Off hides this date and stops new bookings.
          </span>
        </span>
      </label>

      {session && taken > 0 && (
        <p className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs">
          People already booked aren&apos;t told when you change the date, time
          or place. Email them yourself.
        </p>
      )}

      {problem && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Saving..." : session ? "Save changes" : "Add class date"}
        </Button>
        {onDone && (
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
