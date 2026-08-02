import { Check } from "lucide-react";

export function BookedCheckmark() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success">
      <Check className="h-8 w-8 text-surface" strokeWidth={3} aria-hidden />
    </div>
  );
}
