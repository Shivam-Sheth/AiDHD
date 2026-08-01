import type { ReactNode } from "react";

export function WindowChrome({ path, children }: { path: string; children: ReactNode }) {
  const segments = path.split("/").filter(Boolean);
  const trailing = segments.length ? `/${segments[segments.length - 1]}` : path;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-ink/10">
      <div className="flex items-center gap-3 border-b border-line bg-paper/80 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <span className="h-2 w-2 rounded-full bg-coral sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-gold sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-success sm:h-2.5 sm:w-2.5" />
        </div>
        <div className="flex flex-1 justify-center">
          <span className="max-w-full truncate rounded-full border border-line bg-surface px-3 py-1 font-mono text-[11px] text-muted sm:text-xs">
            <span className="hidden sm:inline">{path}</span>
            <span className="sm:hidden">{trailing}</span>
          </span>
        </div>
        <div className="w-[52px] shrink-0 sm:w-[68px]" aria-hidden />
      </div>
      <div className="bg-surface p-5 sm:p-8">{children}</div>
    </div>
  );
}
