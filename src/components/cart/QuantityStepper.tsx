"use client";

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
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`One fewer jar of ${productName}`}
      >
        <Minus size={16} />
      </button>
      <span
        className="min-w-8 text-center font-semibold tabular-nums text-brand-cream"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`One more jar of ${productName}`}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
