"use client";

import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEvents } from "@/lib/mock/EventContext";
import { FlowShell } from "@/components/flow/FlowShell";
import { EventNotFound } from "@/components/flow/EventNotFound";

function stepFromPathname(pathname: string): 2 | 3 | 4 | 5 | 6 {
  const segments = pathname.split("/").filter(Boolean);
  const tail = segments[segments.length - 1];
  const parent = segments[segments.length - 2];
  if (tail === "collect") return 2;
  if (tail === "status") return 3;
  if (tail === "booked") return 6;
  if (tail === "packages") return 4;
  if (parent === "packages") return 5;
  return 4;
}

export default function EventLayout({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const { hydrated, getEvent } = useEvents();

  if (!hydrated) {
    return <div className="min-h-screen bg-paper" />;
  }

  const event = getEvent(slug);
  if (!event) return <EventNotFound />;

  return (
    <FlowShell step={stepFromPathname(pathname)} slug={slug} event={event}>
      {children}
    </FlowShell>
  );
}
