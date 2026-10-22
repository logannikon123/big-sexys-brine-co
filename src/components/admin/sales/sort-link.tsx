import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A column heading that sorts the table by that column. */
export function SortLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        active && "text-brand-orange"
      )}
    >
      {children}
      {active && <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
      {active && <span className="sr-only">(sorted)</span>}
    </Link>
  );
}
