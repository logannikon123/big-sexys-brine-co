"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, Loader2, Lock } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { SquareCard, type SquareCardHandle } from "@/components/checkout/SquareCard";
import { CottageFoodNotice } from "@/components/legal/CottageFoodNotice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deliveryDateWindow } from "@/lib/checkout/dates";
import type { PayResult } from "@/lib/checkout/pay";
import type { Quote, QuoteResult } from "@/lib/checkout/quote";
import { customerSchema } from "@/lib/checkout/schema";
import { cn, formatPrice } from "@/lib/utils";

/** What checkout needs to know about each product. Prices come from the server. */
export interface CheckoutProduct {
  id: number;
  name: string;
  size: string;
  priceCents: number | null;
  /** For sale online, in stock and priced. */
  orderable: boolean;
}

type Method = "pickup" | "local_delivery" | "shipping";

interface CheckoutFormProps {
  products: CheckoutProduct[];
  options: { pickup: boolean; delivery: boolean; shipping: boolean };
  deliveryMinOrderCents: number;
  deliveryStandardHours: number;
  rushFeeCents: number;
  shippingStates: string[];
}

interface AddressFields {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
}

/** A quote error from the route, plus the extra fields it can carry. */
interface QuoteProblem {
  message: string;
  itemProblems?: { productId: number; message: string }[];
}

const METHOD_LABELS: Record<Method, { title: string; detail: string }> = {
  pickup: { title: "Pickup", detail: "Free. Pick up your jars in Lakewood." },
  local_delivery: { title: "Local delivery", detail: "We bring them to your door in the Denver metro area." },
  shipping: { title: "Shipping", detail: "We mail them to you." },
};

const inputClass =
  "bg-card border-brand-brown/30 text-brand-cream placeholder:text-brand-cream/30";

/** "2026-10-27" as "Tuesday, October 27". */
function longDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function CheckoutForm({
  products,
  options,
  deliveryMinOrderCents,
  deliveryStandardHours,
  rushFeeCents,
  shippingStates,
}: CheckoutFormProps) {
  const { items, ready, clear } = useCart();

  const methods: Method[] = [
    ...(options.pickup ? (["pickup"] as const) : []),
    ...(options.delivery ? (["local_delivery"] as const) : []),
    ...(options.shipping ? (["shipping"] as const) : []),
  ];

  const [method, setMethod] = useState<Method | null>(methods[0] ?? null);
  const [address, setAddress] = useState<AddressFields>({
    line1: "",
    line2: "",
    city: "",
    state: "CO",
    postalCode: "",
  });
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [problem, setProblem] = useState<QuoteProblem | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: number; totalCents: number; pending: boolean } | null>(null);
  const cardRef = useRef<SquareCardHandle>(null);
  // One ID per checkout attempt. Square uses it to charge at most once, so a
  // retry after a lost connection keeps it; a new try after a decline gets a
  // new one.
  const checkoutIdRef = useRef<string | null>(null);

  // Any change to the form makes the last price out of date.
  function forgetQuote() {
    setQuote(null);
    setProblem(null);
    checkoutIdRef.current = null;
  }

  function setCustomerField(field: keyof typeof customer, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setProblem(null);
  }

  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = items.flatMap((item) => {
    const product = byId.get(item.productId);
    if (!product?.orderable || product.priceCents == null) return [];
    return [{ ...item, product, priceCents: product.priceCents }];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);

  if (!ready) {
    return <p className="text-brand-cream/60">Loading your cart...</p>;
  }

  if (placed) {
    return (
      <div role="status" className="space-y-4 rounded-xl border border-brand-green/30 bg-brand-green/10 p-8 text-center">
        <CheckCircle size={48} className="mx-auto text-brand-green" />
        <h2 className="font-display text-2xl font-semibold text-brand-cream">
          Thank you! Order #{placed.orderNumber} is in.
        </h2>
        <p className="text-brand-cream/80">
          {placed.pending
            ? `Square is still confirming your payment of ${formatPrice(placed.totalCents)}. We'll start on your order as soon as it clears.`
            : `We charged ${formatPrice(placed.totalCents)} to your card.`}{" "}
          Keep your order number. Questions? Reach us on the{" "}
          <Link href="/contact" className="underline hover:text-brand-orange">contact page</Link>.
        </p>
        <Link
          href="/products"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90"
        >
          Back to the Lineup
        </Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="space-y-4 rounded-xl border border-brand-brown/20 bg-card p-8 text-center">
        <p className="text-lg text-brand-cream">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90"
        >
          See the Lineup
        </Link>
      </div>
    );
  }

  if (!method) {
    return (
      <div className="rounded-xl border border-brand-brown/20 bg-card p-8 text-center text-lg text-brand-cream">
        Pickup, delivery and shipping are all paused right now. Please check back soon.
      </div>
    );
  }

  const dateWindow = deliveryDateWindow(new Date(), deliveryStandardHours);
  const needsAddress = method !== "pickup";
  const belowDeliveryMinimum =
    method === "local_delivery" && subtotal < deliveryMinOrderCents;
  const stateChoices = method === "shipping" ? shippingStates : ["CO"];

  function setField(field: keyof AddressFields, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
    forgetQuote();
  }

  function chooseMethod(next: Method) {
    setMethod(next);
    // Delivery is Colorado only; shipping goes to the listed states.
    const states = next === "shipping" ? shippingStates : ["CO"];
    if (!states.includes(address.state)) {
      setAddress((current) => ({ ...current, state: states[0] ?? "" }));
    }
    forgetQuote();
  }

  /** The cart and the pickup, delivery or shipping choice, as the routes expect them. */
  function cartAndFulfillment() {
    const cleanAddress = {
      line1: address.line1,
      ...(address.line2.trim() ? { line2: address.line2 } : {}),
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    };
    return {
      items: lines.map((line) => ({ productId: line.productId, qty: line.qty })),
      fulfillment:
        method === "pickup"
          ? { type: "pickup" }
          : method === "local_delivery"
            ? { type: "local_delivery", address: cleanAddress, deliveryDate }
            : { type: "shipping", address: cleanAddress },
    };
  }

  async function pay() {
    if (!quote || paying) return;
    setProblem(null);

    const checkedCustomer = customerSchema.safeParse({
      name: customer.name,
      email: customer.email,
      ...(customer.phone.trim() ? { phone: customer.phone } : {}),
      ...(customer.notes.trim() ? { notes: customer.notes } : {}),
    });
    if (!checkedCustomer.success) {
      setProblem({ message: checkedCustomer.error.issues[0]?.message ?? "Check your details." });
      return;
    }
    if (!termsAccepted) {
      setProblem({ message: "Please agree to the terms to place your order." });
      return;
    }

    setPaying(true);
    try {
      const card = await cardRef.current?.tokenize();
      if (!card?.ok) {
        setProblem({ message: card?.message ?? "The card form isn't ready yet. Please wait a moment." });
        return;
      }

      checkoutIdRef.current ??= crypto.randomUUID();
      const res = await fetch("/api/checkout/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cartAndFulfillment(),
          checkoutId: checkoutIdRef.current,
          customer: checkedCustomer.data,
          termsAccepted: true,
          expectedTotalCents: quote.totalCents,
          sourceId: card.token,
        }),
      });
      const result = (await res.json()) as PayResult | { ok: false; message?: string; retrySameCheckout?: boolean };

      if (result.ok) {
        setPlaced({ orderNumber: result.orderNumber, totalCents: result.totalCents, pending: result.pending });
        clear();
        window.scrollTo({ top: 0 });
        return;
      }
      if (!("retrySameCheckout" in result) || !result.retrySameCheckout) {
        checkoutIdRef.current = null;
      }
      if ("quote" in result && result.quote) setQuote(result.quote);
      setProblem({
        message: result.message ?? "We couldn't take the payment. Please try again.",
        itemProblems: "itemProblems" in result ? result.itemProblems : undefined,
      });
    } catch {
      // We don't know whether the order went through, so keep the same
      // checkout ID: a retry can't charge twice.
      setProblem({
        message: "We lost the connection while paying. Try again: you won't be charged twice.",
      });
    } finally {
      setPaying(false);
    }
  }

  async function getPrice(event: React.FormEvent) {
    event.preventDefault();
    if (!method) return;
    setStatus("loading");
    forgetQuote();

    try {
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cartAndFulfillment()),
      });
      const result = (await res.json()) as QuoteResult | { ok: false; message?: string };
      if (result.ok) {
        setQuote(result);
      } else {
        setProblem({
          message: result.message ?? "We couldn't work out your price. Please try again.",
          itemProblems: "itemProblems" in result ? result.itemProblems : undefined,
        });
      }
    } catch {
      setProblem({ message: "We couldn't reach our store. Check your connection and try again." });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={getPrice} className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        <fieldset className="space-y-3">
          <legend className="mb-3 font-display text-xl font-semibold text-brand-cream">
            How do you want your jars?
          </legend>
          {methods.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-colors",
                method === value ? "border-brand-orange" : "border-brand-brown/20 hover:border-brand-brown/50"
              )}
            >
              <input
                type="radio"
                name="method"
                value={value}
                checked={method === value}
                onChange={() => chooseMethod(value)}
                className="mt-1 h-4 w-4 accent-brand-orange"
              />
              <span>
                <span className="block font-semibold text-brand-cream">{METHOD_LABELS[value].title}</span>
                <span className="block text-sm text-brand-cream/60">{METHOD_LABELS[value].detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {needsAddress && (
          <fieldset className="space-y-4">
            <legend className="mb-3 font-display text-xl font-semibold text-brand-cream">
              {method === "local_delivery" ? "Delivery address" : "Shipping address"}
            </legend>
            <div className="space-y-2">
              <Label htmlFor="line1" className="text-brand-cream/80">Street address</Label>
              <Input
                id="line1"
                required
                autoComplete="address-line1"
                value={address.line1}
                onChange={(e) => setField("line1", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line2" className="text-brand-cream/80">
                Apartment, suite or unit <span className="text-brand-cream/40">(optional)</span>
              </Label>
              <Input
                id="line2"
                autoComplete="address-line2"
                value={address.line2}
                onChange={(e) => setField("line2", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-brand-cream/80">City</Label>
                <Input
                  id="city"
                  required
                  autoComplete="address-level2"
                  value={address.city}
                  onChange={(e) => setField("city", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-brand-cream/80">State</Label>
                <select
                  id="state"
                  required
                  autoComplete="address-level1"
                  value={address.state}
                  onChange={(e) => setField("state", e.target.value)}
                  className={cn("flex h-10 w-full rounded-md border px-3 py-2 text-sm", inputClass)}
                >
                  {stateChoices.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode" className="text-brand-cream/80">ZIP code</Label>
                <Input
                  id="postalCode"
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="\d{5}(-\d{4})?"
                  title="A 5-digit ZIP code"
                  value={address.postalCode}
                  onChange={(e) => setField("postalCode", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>
        )}

        {method === "local_delivery" && (
          <fieldset className="space-y-2">
            <legend className="mb-3 font-display text-xl font-semibold text-brand-cream">
              Delivery date
            </legend>
            <Input
              id="deliveryDate"
              type="date"
              required
              min={dateWindow.earliest}
              max={dateWindow.latest}
              value={deliveryDate}
              onChange={(e) => {
                setDeliveryDate(e.target.value);
                forgetQuote();
              }}
              className={cn(inputClass, "max-w-xs")}
              aria-label="Delivery date"
              aria-describedby="deliveryDateHelp"
            />
            <p id="deliveryDateHelp" className="text-sm text-brand-cream/60">
              Pick {longDate(dateWindow.standardFrom)} or later for standard delivery.
              {rushFeeCents > 0 && ` Sooner dates add a ${formatPrice(rushFeeCents)} rush fee.`}
            </p>
          </fieldset>
        )}

        {belowDeliveryMinimum && (
          <p role="status" className="rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-4 text-sm text-brand-cream">
            Local delivery needs an order of at least {formatPrice(deliveryMinOrderCents)}. Add
            more jars, or choose another way to get them.
          </p>
        )}

        <fieldset className="space-y-4">
          <legend className="mb-3 font-display text-xl font-semibold text-brand-cream">
            Your details
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerName" className="text-brand-cream/80">Name</Label>
              <Input
                id="customerName"
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
                autoComplete="email"
                value={customer.email}
                onChange={(e) => setCustomerField("email", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone" className="text-brand-cream/80">
              Phone <span className="text-brand-cream/40">(optional, for questions about your order)</span>
            </Label>
            <Input
              id="customerPhone"
              type="tel"
              autoComplete="tel"
              value={customer.phone}
              onChange={(e) => setCustomerField("phone", e.target.value)}
              className={cn(inputClass, "sm:max-w-xs")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerNotes" className="text-brand-cream/80">
              Notes <span className="text-brand-cream/40">(optional)</span>
            </Label>
            <Textarea
              id="customerNotes"
              rows={3}
              maxLength={500}
              placeholder={method === "local_delivery" ? "Gate code, where to leave the jars..." : ""}
              value={customer.notes}
              onChange={(e) => setCustomerField("notes", e.target.value)}
              className={cn(inputClass, "resize-none")}
            />
          </div>
        </fieldset>
      </div>

      <div className="h-fit space-y-4 rounded-xl border border-brand-brown/20 bg-card p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold text-brand-cream">Your order</h2>
        <ul className="space-y-2 text-sm">
          {(quote?.lines ?? lines.map((line) => ({
            productId: line.productId,
            name: line.product.name,
            size: line.product.size || null,
            qty: line.qty,
            lineTotalCents: line.priceCents * line.qty,
          }))).map((line) => (
            <li key={line.productId} className="flex justify-between gap-4 text-brand-cream/80">
              <span>
                {line.qty} × {line.name}
                {line.size ? `, ${line.size}` : ""}
              </span>
              <span className="tabular-nums">{formatPrice(line.lineTotalCents)}</span>
            </li>
          ))}
        </ul>

        {quote ? <QuoteSummary quote={quote} /> : (
          <div className="flex items-baseline justify-between gap-4 border-t border-brand-brown/30 pt-4">
            <span className="text-brand-cream/80">Subtotal</span>
            <span className="font-semibold text-brand-gold tabular-nums">{formatPrice(subtotal)}</span>
          </div>
        )}

        {problem && (
          <div role="alert" className="space-y-1 rounded-lg border border-brand-red/40 bg-brand-red/10 p-3 text-sm text-brand-cream">
            <p className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-brand-red" />
              {problem.message}
            </p>
            {problem.itemProblems && problem.itemProblems.length > 0 && (
              <ul className="list-disc pl-8">
                {problem.itemProblems.map((item) => (
                  <li key={item.productId}>{item.message}</li>
                ))}
              </ul>
            )}
            {problem.itemProblems && (
              <Link href="/cart" className="inline-block pl-6 underline hover:text-brand-orange">
                Go to your cart
              </Link>
            )}
          </div>
        )}

        {!quote && (
          <button
            type="submit"
            disabled={status === "loading" || belowDeliveryMinimum}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Working out your price...
              </>
            ) : (
              "See my total"
            )}
          </button>
        )}

        {quote && (
          <div className="space-y-4 border-t border-brand-brown/30 pt-4">
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
                <Link href="/terms" target="_blank" className="underline hover:text-brand-orange">terms</Link>{" "}
                and{" "}
                <Link href="/refunds" target="_blank" className="underline hover:text-brand-orange">refund policy</Link>.
              </span>
            </label>
            <button
              type="button"
              onClick={pay}
              disabled={paying}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-orange px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paying ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Paying...
                </>
              ) : (
                `Pay ${formatPrice(quote.totalCents)}`
              )}
            </button>
          </div>
        )}

        <p className="text-sm text-brand-cream/60">
          <Link href="/cart" className="underline hover:text-brand-orange">Change your cart</Link>
          {" · "}
          <Link href="/shipping" className="underline hover:text-brand-orange">How delivery works</Link>
          {" · "}
          <Link href="/refunds" className="underline hover:text-brand-orange">Refunds</Link>
        </p>
        <CottageFoodNotice />
      </div>
    </form>
  );
}

function QuoteSummary({ quote }: { quote: Quote }) {
  const f = quote.fulfillment;
  const rows: { label: string; cents: number }[] = [
    { label: "Subtotal", cents: quote.subtotalCents },
    ...(f.type === "local_delivery"
      ? [
          {
            label: f.freeDeliveryApplied ? "Delivery (free)" : `Delivery (${f.miles} miles)`,
            cents: quote.deliveryFeeCents,
          },
          ...(quote.rushFeeCents > 0 ? [{ label: "Rush fee", cents: quote.rushFeeCents }] : []),
        ]
      : []),
    ...(f.type === "shipping"
      ? [
          { label: `Packing (${f.boxes} ${f.boxes === 1 ? "box" : "boxes"})`, cents: quote.packingFeeCents },
          { label: "Postage", cents: quote.postageCents },
        ]
      : []),
    ...(quote.discountCents > 0 ? [{ label: "Discount", cents: -quote.discountCents }] : []),
  ];

  return (
    <div className="space-y-3 border-t border-brand-brown/30 pt-4 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 text-brand-cream/80">
          <span>{row.label}</span>
          <span className="tabular-nums">{formatPrice(row.cents)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-4 text-brand-cream/80">
        <span>
          Local sales tax
          {quote.tax.status === "ok" && quote.tax.jurisdiction ? ` (${quote.tax.jurisdiction})` : ""}
        </span>
        <span className="tabular-nums">
          {quote.tax.status === "ok" ? formatPrice(quote.taxCents) : "To be confirmed"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-brand-brown/30 pt-3">
        <span className="font-semibold text-brand-cream">Total</span>
        <span className="font-display text-2xl font-bold text-brand-gold tabular-nums">
          {formatPrice(quote.totalCents)}
        </span>
      </div>

      {quote.tax.note && <p className="text-brand-cream/60">{quote.tax.note}</p>}
      {f.type === "pickup" && f.instructions && (
        <p className="text-brand-cream/60">{f.instructions}</p>
      )}
      {f.type === "local_delivery" && (
        <p className="text-brand-cream/60">
          Delivery on {longDate(f.deliveryDate)}.{f.instructions ? ` ${f.instructions}` : ""}
        </p>
      )}
      {quote.warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-brand-gold">
          {quote.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
