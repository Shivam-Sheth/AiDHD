import type { MandateData } from "@/lib/types-client";
import { StatusPill } from "./StatusPill";

export function MandateStatusRow({ mandate }: { mandate: MandateData }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-ink capitalize">
          {mandate.category}
          <span className="font-normal text-faint"> · {mandate.merchant}</span>
        </div>
        <div className="text-xs text-faint">Cap ${mandate.amount_cap}</div>
      </div>
      <StatusPill status={mandate.status} />
    </div>
  );
}
