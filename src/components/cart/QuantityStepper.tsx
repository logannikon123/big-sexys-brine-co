"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_QTY_PER_LINE } from "@/lib/cart/store";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Product name, read out by screen readers. */
  productName: string;
  min?: number;
  max?: number;
  className?: string;
}

const buttonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-cream transition-colors hover:bg-white/10 hover:text-brand-orange disabled:pointer-events-none disabled:opacity-30";

export function QuantityStepper({
  value,
  onChange,
  productName,
  min = 1,
  max = MAX_QTY_PER_LINE,
  className,
}: QuantityStepperProps) {
  // What the box shows while someone types. It can be empty for a moment,
  // so it lives apart from the real quantity.
  const [draft, setDraft] = useState(String(value));
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setDraft(String(value));
  }

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.floor(n)));

  function handleType(text: string) {
    const digits = text.replace(/\D/g, "");
    setDraft(digits);
    const n = Number(digits);
    if (digits !== "" && n >= min) onChange(clamp(n));
  }

  return (
    <div
      role="group"
      aria-label={`How many jars of ${productName}`}
      className={cn(
        "inline-flex items-center rounded-full border border-brand-cream/20",
        className
      )}
    >
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`One fewer jar of ${productName}`}
      >
        <Minus size={16} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={String(max).length}
        value={draft}
        onChange={(event) => handleType(event.target.value)}
        onBlur={() => setDraft(String(value))}
        onFocus={(event) => event.target.select()}
        aria-label={`Number of jars of ${productName}`}
        className="h-9 w-12 rounded-md bg-transparent text-center font-semibold tabular-nums text-brand-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      />
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`One more jar of ${productName}`}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
