"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { MockEvent } from "@/lib/mock/types";
import { WindowChrome } from "./WindowChrome";
import { StepPills } from "./StepPills";
import { ModeBadge } from "./ModeBadge";
import { PageTransition } from "./PageTransition";

export function FlowShell({
  step,
  slug,
  event,
  pathOverride,
  modeSlot,
  children,
}: {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  slug?: string;
  event?: MockEvent;
  pathOverride?: string;
  modeSlot?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const path = pathOverride ?? `aidhd.app${pathname}`;

  return (
    <div className="min-h-screen bg-canvas px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
        <div>{modeSlot ?? (event ? <ModeBadge type={event.type} /> : null)}</div>
        <StepPills current={step} slug={slug} event={event} />
        <div className="w-full">
          <WindowChrome path={path}>
            <PageTransition>{children}</PageTransition>
          </WindowChrome>
        </div>
      </div>
    </div>
  );
}
