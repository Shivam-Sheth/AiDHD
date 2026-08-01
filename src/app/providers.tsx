"use client";

import type { ReactNode } from "react";
import { EventProvider } from "@/lib/mock/EventContext";
import { ToastProvider } from "@/components/flow/ToastProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <EventProvider>
      <ToastProvider>{children}</ToastProvider>
    </EventProvider>
  );
}
