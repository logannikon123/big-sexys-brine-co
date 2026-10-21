"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";

/**
 * Turns the consent details on and off. The choice lives in the address
 * (?details=1), so the server draws the page and the link can be shared.
 */
export function DetailsSwitch({ on }: { on: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    startTransition(() => {
      router.replace(next ? `${pathname}?details=1` : pathname, { scroll: false });
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Switch
        id="marketing-details"
        checked={on}
        onCheckedChange={change}
        disabled={pending}
        aria-labelledby="marketing-details-label"
      />
      <label
        id="marketing-details-label"
        htmlFor="marketing-details"
        className="cursor-pointer text-sm font-medium"
      >
        Show consent details (for legal records)
      </label>
      {pending && <span className="text-xs text-muted-foreground">Loading...</span>}
    </div>
  );
}
