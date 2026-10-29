"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2, Lock } from "lucide-react";
import { UPCOMING_CLASSES_ID } from "@/components/classes/UpcomingClasses";
import { SquareCard, type SquareCardHandle } from "@/components/checkout/SquareCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BookResult } from "@/lib/classes/book";
import { bookClassInputSchema } from "@/lib/classes/schema";
import { MARKETING_CONSENT_TEXT } from "@/lib/marketing";
import { cn, formatPrice } from "@/lib/utils";
import { MAX_SEATS_PER_BOOKING } from "@/types/classes";

interface BookingFormProps {
  sessionId: number;
  priceCents: number;
  seatsLeft: number;
}

/** The booking route's answer, plus the shapes it can take when something breaks. */
type BookAnswer =
  | BookResult
  | { ok: false; code?: string; message?: string; retrySameCheckout?: boolean; seatsLeft?: number; priceCents?: number };

const inputClass =
  "bg-card border-brand-brown/30 text-brand-cream placeholder:text-brand-cream/30";

const customerSchema = bookClassInputSchema.shape.customer;

/** Answers that mean this date can't be booked any more. */
const STOPPED_CODES = new Set(["not_found", "closed"]);

export function BookingForm({ sessionId, priceCents: startPriceCents, seatsLeft: startSeatsLeft }: BookingFormProps) {
  const router = useRouter();
  const [priceCents, setPriceCents] = useState(startPriceCents);
  const [seatsLeft, setSeatsLeft] = useState(startSeatsLeft);
  const [seats, setSeats] = useState(1);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Ticked to start, as in jar checkout (Jesse's choice). The customer unticks it to say no.
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [paying, setPaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Set when the price changed under the customer, so the form can point at the new total.
  const [priceChanged, setPriceChanged] = useState(false);
  // Set when this date can't be booked any more (closed or gone).
  const [stopped, setStopped] = useState(false);
  const [booked, setBooked] = useState<{ orderNumber: number; publicToken: string } | null>(null);
  const cardRef = useRef<SquareCardHandle>(null);
  // Blocks a second click before React has redrawn the button as disabled.
  const busyRef = useRef(false);
  // One checkout per try at paying: an ID and the card code. Until we know
  // how a try ended, a retry sends the same ID and card code, so Square
  // charges at most once. Only an answer that says the try is over starts a
  // new checkout. The same rules as jar checkout.
  const checkoutRef = useRef<{ id: string; token: string } | null>(null);
  // True while a checkout is open. The seats can't change until it ends,
  // because the server keeps the booking it saved for that checkout.
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const maxSeats = Math.max(0, Math.min(MAX_SEATS_PER_BOOKING, seatsLeft));
  const soldOut = maxSeats === 0;
  const totalCents = priceCents * seats;

  function endCheckout() {
    checkoutRef.current = null;
    setCheckoutOpen(false);
  }

  function setCustomerField(field: keyof typeof customer, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setProblem(null);
  }

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current || booked || stopped || soldOut) return;
    setProblem(null);

    const checkedCustomer = customerSchema.safeParse({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      ...(customer.notes.trim() ? { notes: customer.notes } : {}),
    });
    if (!checkedCustomer.success) {
      setProblem(checkedCustomer.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    if (!termsAccepted) {
      setProblem("Please agree to the class policy, terms, refund policy and privacy policy to book.");
      return;
    }

    busyRef.current = true;
    setPaying(true);
    let done = false;
    try {
      let checkout = checkoutRef.current;
      if (!checkout) {
        const card = await cardRef.current?.tokenize();
        if (!card?.ok) {
          setProblem(card?.message ?? "The card form isn't ready yet. Please wait a moment.");
          return;
        }
        checkout = { id: crypto.randomUUID(), token: card.token };
        checkoutRef.current = checkout;
        setCheckoutOpen(true);
      }

      const res = await fetch("/api/classes/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutId: checkout.id,
          sessionId,
          seats,
          customer: checkedCustomer.data,
          termsAccepted: true,
          expectedTotalCents: totalCents,
          sourceId: checkout.token,
          marketingOptIn,
        }),
      });
      const result = (await res.json()) as BookAnswer;

      if (result.ok) {
        done = true;
        setBooked({ orderNumber: result.orderNumber, publicToken: result.publicToken });
        // Replace, so the Back button doesn't land on a form that was already paid.
        router.replace(`/order/${result.publicToken}`);
        return;
      }

      // Any other answer (a busy server, a rate limit) keeps the checkout.
      if (result.retrySameCheckout === false) endCheckout();

      if (result.code === "full" && typeof result.seatsLeft === "number") {
        const left = Math.max(0, result.seatsLeft);
        setSeatsLeft(left);
        setSeats((current) => Math.max(1, Math.min(current, left, MAX_SEATS_PER_BOOKING)));
      }
      if (result.code === "price_changed" && typeof result.priceCents === "number") {
        setPriceCents(result.priceCents);
        setPriceChanged(true);
      }
      if (result.code && STOPPED_CODES.has(result.code)) setStopped(true);

      setProblem(result.message ?? "We couldn't take the payment. Please try again.");
    } catch {
      // We don't know whether the booking went through, so keep the same
      // checkout: a retry sends the same request and can't charge twice.
      setProblem("We lost the connection while paying. Try again: you won't be charged twice.");
    } finally {
      // After a booking the form stays locked while the order page loads.
      if (!done) {
        busyRef.current = false;
        setPaying(false);
      }
    }
  }

  if (booked) {
    return (
      <div role="status" className="space-y-4 rounded-xl border border-brand-green/30 bg-brand-green/10 p-8 text-center">
        <CheckCircle size={48} className="mx-auto text-brand-green" />
        <h2 className="font-display text-2xl font-semibold text-brand-cream">
          You&apos;re booked! Booking #{booked.orderNumber} is in.
        </h2>
        <p className="text-brand-cream/80">Taking you to your booking...</p>
        <Link
          href={`/order/${booked.publicToken}`}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90"
        >
          See your booking
        </Link>
      </div>
    );
  }

  const seatOptions = Array.from({ length: maxSeats }, (_, i) => i + 1);

  return (
    <form onSubmit={pay} className="space-y-8" noValidate>
      <fieldset disabled={checkoutOpen || stopped || soldOut} className="space-y-2 disabled:opacity-60">
        <legend className="mb-3 font-display text-xl font-semibold text-brand-cream">Seats</legend>
        <Label htmlFor="seats" className="text-brand-cream/80">
          How many people are coming?
        </Label>
        {soldOut ? (
          <p className="text-brand-cream/80">No seats are left for this date.</p>
        ) : (
          <select
            id="seats"
            value={seats}
            onChange={(e) => {
              setSeats(Number(e.target.value));
              setProblem(null);
              setPriceChanged(false);
            }}
            className={cn("flex h-10 w-full max-w-xs rounded-md border px-3 py-2 text-sm", inputClass)}
          >
            {seatOptions.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "seat" : "seats"}
              </option>
            ))}
          </select>
        )}
        <p className="text-sm text-brand-cream/60">
          One booking can take up to {MAX_SEATS_PER_BOOKING} seats.
          {!soldOut && ` ${seatsLeft} ${seatsLeft === 1 ? "seat is" : "seats are"} left.`}
        </p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-xl font-semibold text-brand-cream">Your details</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName" className="text-brand-cream/80">Name</Label>
            <Input
              id="customerName"
              required
              autoComplete="name"
              value={customer.name}
              onChange={(e) => setCustomerField("name", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail" className="text-brand-cream/80">Email</Label>
            <Input
              id="customerEmail"
              type="email"
              required
              autoComplete="email"
              value={customer.email}
              onChange={(e) => setCustomerField("email", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerPhone" className="text-brand-cream/80">
            Phone <span className="text-brand-cream/40">(in case the class changes)</span>
          </Label>
          <Input
            id="customerPhone"
            type="tel"
            required
            autoComplete="tel"
            value={customer.phone}
            onChange={(e) => setCustomerField("phone", e.target.value)}
            className={cn(inputClass, "sm:max-w-xs")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerNotes" className="text-brand-cream/80">
            Allergies or anything we should know <span className="text-brand-cream/40">(optional)</span>
          </Label>
          <Textarea
            id="customerNotes"
            rows={3}
            maxLength={500}
            value={customer.notes}
            onChange={(e) => setCustomerField("notes", e.target.value)}
            className={cn(inputClass, "resize-none")}
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-cream/80">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-orange"
          />
          <span>
            {MARKETING_CONSENT_TEXT}{" "}
            <span className="text-brand-cream/50">
              Optional. Unsubscribe any time. See our{" "}
              <Link href="/privacy" target="_blank" className="underline hover:text-brand-orange">privacy policy</Link>.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="space-y-4 rounded-xl border border-brand-brown/20 bg-card p-5 sm:p-6">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4 text-brand-cream/80">
            <span>
              {seats} {seats === 1 ? "seat" : "seats"} × {formatPrice(priceCents)}
            </span>
            <span className="tabular-nums">{formatPrice(totalCents)}</span>
          </div>
          <div className="flex justify-between gap-4 text-brand-cream/80">
            <span>Sales tax (none on classes)</span>
            <span className="tabular-nums">{formatPrice(0)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-brand-brown/30 pt-3">
            <span className="font-semibold text-brand-cream">Total</span>
            <span className="font-display text-2xl font-bold text-brand-gold tabular-nums">
              {formatPrice(totalCents)}
            </span>
          </div>
        </div>

        {priceChanged && !problem && (
          <p role="status" className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-3 text-sm text-brand-cream">
            The price is now {formatPrice(priceCents)} a seat. Press Pay to book at the new total.
          </p>
        )}

        {problem && (
          <div role="alert" className="space-y-1 rounded-lg border border-brand-red/40 bg-brand-red/10 p-3 text-sm text-brand-cream">
            <p className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-brand-red" />
              {problem}
            </p>
            {(stopped || soldOut) && (
              <Link href={`/learn-to-preserve#${UPCOMING_CLASSES_ID}`} className="inline-block pl-6 underline hover:text-brand-orange">
                See other class dates
              </Link>
            )}
          </div>
        )}

        {!stopped && !soldOut && (
          <>
            <h3 className="flex items-center gap-2 font-semibold text-brand-cream">
              <Lock size={16} className="text-brand-cream/60" /> Pay by card
            </h3>
            <SquareCard ref={cardRef} />
            <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-cream/80">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  setProblem(null);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-orange"
              />
              <span>
                I agree to the{" "}
                <a href="#class-policy" className="underline hover:text-brand-orange">class policy</a>,{" "}
                <Link href="/terms" target="_blank" className="underline hover:text-brand-orange">terms</Link>,{" "}
                <Link href="/refunds" target="_blank" className="underline hover:text-brand-orange">refund policy</Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="underline hover:text-brand-orange">privacy policy</Link>.
                <span className="text-brand-cream/50"> Required to book.</span>
              </span>
            </label>
            <button
              type="submit"
              disabled={paying || !termsAccepted}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paying ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Paying...
                </>
              ) : (
                `Pay ${formatPrice(totalCents)}`
              )}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
