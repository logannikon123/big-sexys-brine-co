"use client";

import { cn } from "@/lib/utils";

interface RangeProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** How to show the value, like 6 becoming "6 seconds". */
  format?: (value: number) => string;
  help?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A slider with its label and its current value. It is the browser's own
 * slider, so it works with a mouse, a finger and the arrow keys.
 */
export function Range({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
  help,
  disabled,
  className,
}: RangeProps) {
  const shown = format(value);
  return (
    <div className={cn("space-y-2", disabled && "opacity-50", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium leading-none">
          {label}
        </label>
        <output htmlFor={id} className="text-sm tabular-nums text-muted-foreground">
          {shown}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-brand-orange disabled:cursor-not-allowed"
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
