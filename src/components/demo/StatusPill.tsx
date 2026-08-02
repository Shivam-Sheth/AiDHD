import clsx from "clsx";

export function StatusPill({ status }: { status: string }) {
  const ok = status === "approved" || status === "used" || status === "confirmed";
  const bad = status === "failed";

  return (
    <span
      className={clsx(
        "rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        ok && "bg-success-soft text-success",
        bad && "bg-danger-soft text-danger",
        !ok && !bad && "bg-line text-muted",
      )}
    >
      {status}
    </span>
  );
}
