"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Repeat } from "lucide-react";
import { EventDeleteButton } from "./event-delete-button";
import { SortableList } from "@/components/admin/sortable-list";
import { eventDayParts, formatEventDay } from "@/lib/event-dates";
import { updateEventOrder } from "../actions";

const typeBadgeColors: Record<string, string> = {
  market: "bg-brand-green text-white",
  festival: "bg-brand-orange text-white",
  "pop-up": "bg-brand-gold text-brand-black",
  class: "bg-brand-brown text-brand-cream",
};

interface Event {
  id: number;
  name: string;
  date: string;
  end_date: string | null;
  is_recurring: boolean;
  recurrence_day: string | null;
  time: string;
  location: string;
  address: string | null;
  type: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

function formatDate(event: Event): string {
  const start = formatEventDay(event.date, {
    month: "short",
    day: "numeric",
  });
  if (event.is_recurring && event.recurrence_day && event.end_date) {
    const end = formatEventDay(event.end_date, {
      month: "short",
      day: "numeric",
    });
    return `${event.recurrence_day}s, ${start} – ${end}`;
  }
  if (event.end_date) {
    const end = formatEventDay(event.end_date, {
      month: "short",
      day: "numeric",
    });
    return `${start} – ${end}`;
  }
  const { year } = eventDayParts(event.date);
  return `${start}, ${year}`;
}

export function EventsSortableList({ events }: { events: Event[] }) {
  return (
    <SortableList
      items={events}
      onReorder={updateEventOrder}
      renderItem={(event) => (
        <div className="flex items-center gap-4 py-2 pr-3">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="font-medium">{event.name}</span>
            {event.is_recurring && (
              <Repeat className="h-3.5 w-3.5 text-brand-green flex-shrink-0" />
            )}
          </div>
          <span className="text-sm text-muted-foreground w-40 text-center">
            {formatDate(event)}
          </span>
          <span className="text-sm text-muted-foreground w-20 text-center">
            {event.time}
          </span>
          <span className="text-sm text-muted-foreground w-32 truncate">
            {event.location}
          </span>
          <Badge className={typeBadgeColors[event.type] ?? ""}>
            {event.type}
          </Badge>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/events/${event.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <EventDeleteButton id={event.id} name={event.name} />
          </div>
        </div>
      )}
    />
  );
}
