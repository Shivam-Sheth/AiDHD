import type { ReactNode } from "react";

export function DemoBrowserChrome({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card shadow-card">
      <div className="flex items-center gap-2 border-b border-line bg-canvas/80 px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-ink" />
        <div className="h-2 w-2 rounded-full bg-ink" />
        <div className="h-2 w-2 rounded-full bg-success" />
        <span className="ml-2 text-sm font-medium text-faint">AiDHD — {title}</span>
      </div>
      <div className="space-y-6 p-5 sm:p-6">{children}</div>
    </div>
  );
}
