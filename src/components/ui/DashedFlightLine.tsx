import clsx from "clsx";

export function DashedFlightLine({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={clsx("h-4 w-full", className)}
      viewBox="0 0 400 16"
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1="8"
        x2="400"
        y2="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />
    </svg>
  );
}
