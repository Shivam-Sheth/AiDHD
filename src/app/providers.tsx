"use client";

import type { ReactNode } from "react";
import { EventProvider } from "@/lib/mock/EventContext";
import { ToastProvider } from "@/components/flow/ToastProvider";
import { InstallAppBanner } from "@/components/pwa/InstallAppBanner";
import { PwaRegister } from "@/components/pwa/PwaRegister";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <EventProvider>
      <ToastProvider>
        <PwaRegister />
        {children}
        <InstallAppBanner />
      </ToastProvider>
    </EventProvider>
  );
}
