"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatPrice } from "@/lib/utils";
import { splitRefund, type RefundFor } from "@/lib/tax-split";
import { saveRefundFor } from "@/app/admin/orders/actions";

interface RefundForFormProps {
  refundId: number;
  amountCents: number;
  /** The order's total food rate, 0 if it paid no tax. */
  rateBps: number;
  /** The saved answer, if any. */
  refundFor: RefundFor | null;
  /** The saved jar part, to fill in the box for "Some of each". */
  jarsCents: number | null;
  demo: boolean;
  /** Called after a save, so the page can close the form. */
  onDone?: () => void;
}

const CHOICES: { value: RefundFor; title: string; detail: string }[] = [
  {
    value: "fees",
    title: "Fees only",
    detail: "Delivery, rush, packing or postage. No tax went back.",
  },
  {
    value: "jars",
    title: "Jars only",
    detail: "Jars and the tax on them.",
  },
  {
    value: "both",
    title: "Some of each",
    detail: "Some jars plus a fee. Type the jar price below.",
  },
  {
    value: "unsure",
    title: "Not sure",
    detail: "The tax report lists it for you to check.",
  },
];

/** "12.5" or "$12.50" becomes 1250. Anything else becomes null. */
function parseDollars(text: string): number | null {
  const match = /^\$?\s*(\d{1,5})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Ask what a part refund was for, show the split it gives, and save it. */
export function RefundForForm({
  refundId,
  amountCents,
  rateBps,
  refundFor,
  jarsCents,
  demo,
  onDone,
}: RefundForFormProps) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<RefundFor | null>(refundFor);
  const [jarsText, setJarsText] = useState(
    refundFor === "both" && jarsCents !== null ? (jarsCents / 100).toFixed(2) : ""
  );

  const typedJars = parseDollars(jarsText);
  const split = choice ? splitRefund(amountCents, rateBps, choice, typedJars ?? 0) : null;
  const ready = choice === "unsure" || split !== null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!choice || !ready) return;
    if (demo) {
      toast.info("Demo only, nothing saved");
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveRefundFor(
          refundId,
          choice,
          choice === "both" ? typedJars : null
        );
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Saved");
          onDone?.();
        }
      } catch {
        toast.error(
          "Something went wrong and nothing was saved. Check your connection and try again."
        );
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">This refund was for</legend>
        {CHOICES.map((c) => (
          <label
            key={c.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3",
              choice === c.value
                ? "border-brand-orange bg-brand-orange/10"
                : "border-border hover:bg-muted"
            )}
          >
            <input
              type="radio"
              name={`refund-for-${id}`}
              value={c.value}
              checked={choice === c.value}
              onChange={() => setChoice(c.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-orange"
            />
            <span className="text-sm">
              <span className="block font-medium">{c.title}</span>
              <span className="block text-muted-foreground">{c.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {choice === "both" && (
        <div className="space-y-1">
          <label htmlFor={`refund-jars-${id}`} className="text-sm font-medium">
            Jar price refunded, before tax
          </label>
          <Input
            id={`refund-jars-${id}`}
            inputMode="decimal"
            placeholder="12.00"
            className="h-11 text-base"
            value={jarsText}
            onChange={(e) => setJarsText(e.target.value)}
          />
          {jarsText.trim() !== "" && !split && (
            <p className="text-xs text-red-300">
              {typedJars === null || typedJars === 0
                ? "Type a dollar amount, like 12.00."
                : `The jars and their tax come to more than the ${formatPrice(amountCents)} refund.`}
            </p>
          )}
        </div>
      )}

      {split && (
        <p className="rounded-md bg-muted/50 p-3 text-sm" aria-live="polite">
          Jars {formatPrice(split.jarsCents)}, tax {formatPrice(split.taxCents)}, fees{" "}
          {formatPrice(split.feesCents)}
        </p>
      )}

      <Button
        type="submit"
        variant="secondary"
        className="h-11 w-full"
        disabled={pending || !ready}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}

/**
 * The saved answer with a Change button, or the form when there is no
 * answer yet. summary is the saved split, worked out by the page.
 */
export function RefundForBox({
  summary,
  ...form
}: RefundForFormProps & { summary: React.ReactNode }) {
  const [editing, setEditing] = useState(form.refundFor === null);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">{summary}</div>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => setEditing(true)}
        >
          Change
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <RefundForForm {...form} onDone={() => setEditing(false)} />
      {form.refundFor !== null && (
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full"
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
