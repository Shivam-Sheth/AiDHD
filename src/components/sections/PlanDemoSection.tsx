"use client";

import { Section } from "@/components/ui/Section";
import { usePlanningDemo } from "@/components/demo/usePlanningDemo";
import { EventModeToggle } from "@/components/demo/EventModeToggle";
import { DemoBrowserChrome } from "@/components/demo/DemoBrowserChrome";
import { GroupResponseCard } from "@/components/demo/GroupResponseCard";
import { PlanCard } from "@/components/demo/PlanCard";
import { MandateStatusRow } from "@/components/demo/MandateStatusRow";
import { BookingResultPanel } from "@/components/demo/BookingResultPanel";
import { WhatsAppSandboxPanel } from "@/components/demo/WhatsAppSandboxPanel";

export function PlanDemoSection() {
  const demo = usePlanningDemo();
  const { snap, phase, busy, error, chosen } = demo;
  // event.status only reaches "confirmed" when every category books successfully — a partial
  // failure (see demo.failedBooking) leaves it stuck on "paying" forever, so we also treat
  // "bookings exist" as the signal to show the result panel instead of the pay button.
  const hasBookings = (snap?.bookings.length ?? 0) > 0;
  const showResult = phase === "done" || hasBookings;

  return (
    <Section
      id="demo"
      tone="paper"
      eyebrow="Live demo"
      title="Watch the whole flow, live."
      subtitle="Real responses, a real reconciliation pass, real per-category Prava mandates — running against this repo's actual backend, not a mockup."
    >
      <div className="mt-6">
        <EventModeToggle eventId={demo.eventId} onChange={demo.setEventId} />
      </div>

      {error && (
        <p className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-center text-sm text-danger">{error}</p>
      )}

      <div className="mt-10 mx-auto max-w-3xl">
        <DemoBrowserChrome title={snap?.event.title ?? "loading…"}>
          {phase === "idle" && (
            <div className="py-8 text-center">
              <p className="text-muted">Load the demo group, then watch plans appear.</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void demo.startDemo()}
                className="mt-6 rounded-xl bg-gradient-to-r from-coral to-gold px-6 py-3 font-semibold text-dusk-950 shadow-warm disabled:opacity-50"
              >
                {busy ? "Working…" : "Start demo"}
              </button>
            </div>
          )}

          {(phase === "group" || phase === "plans" || phase === "pay" || phase === "done") && (
            <div>
              <p className="mb-3 text-xs font-medium tracking-wider text-faint uppercase">The group</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(snap?.responses ?? []).map((r) => (
                  <GroupResponseCard
                    key={r.id}
                    response={r}
                    user={snap?.users.find((u) => u.id === r.user_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {(phase === "plans" || phase === "pay" || phase === "done") && (
            <div>
              <p className="mb-3 text-xs font-medium tracking-wider text-faint uppercase">
                {phase === "plans" ? "Pick a plan" : "Selected plan"}
              </p>
              <div className="space-y-3">
                {(phase === "plans" ? (snap?.packages ?? []) : chosen ? [chosen] : []).map((pkg) => (
                  <PlanCard
                    key={pkg.id}
                    pkg={pkg}
                    selected={chosen?.id === pkg.id}
                    disabled={busy || phase !== "plans"}
                    onSelect={() => void demo.choosePlan(pkg)}
                  />
                ))}
              </div>
              {phase === "plans" && (
                <p className="mt-3 text-center text-xs text-faint">
                  Tap a plan to request Prava payment limits
                </p>
              )}
            </div>
          )}

          {(phase === "pay" || phase === "done") && (
            <div>
              <p className="mb-3 text-xs font-medium tracking-wider text-faint uppercase">
                Pay with Prava — one limit per category
              </p>
              <div className="space-y-2">
                {(snap?.mandates ?? []).map((m) => (
                  <MandateStatusRow key={m.id} mandate={m} />
                ))}
              </div>

              {phase === "pay" && !hasBookings && (
                <>
                  <label className="mt-4 flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={demo.failTicketDemo}
                      onChange={(e) => demo.setFailTicketDemo(e.target.checked)}
                      className="h-4 w-4 rounded border-line accent-coral"
                    />
                    Simulate a failed ticket booking — shows the per-category re-mandate flow
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void demo.payAndBook()}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-coral to-gold py-3.5 font-semibold text-dusk-950 shadow-warm disabled:opacity-50"
                  >
                    {busy ? "Booking…" : "Approve & book"}
                  </button>
                </>
              )}
            </div>
          )}

          {showResult && (
            <BookingResultPanel
              bookings={snap?.bookings ?? []}
              failedBooking={demo.failedBooking}
              voiceClip={demo.voiceClip}
              busy={busy}
              onRerequestFailed={() => void demo.rerequestFailedMandate()}
              onReset={() => void demo.resetDemo()}
            />
          )}
        </DemoBrowserChrome>

        {demo.integrations.whatsapp === "live" && (
          <WhatsAppSandboxPanel
            busy={busy}
            waPhones={demo.waPhones}
            setWaPhones={demo.setWaPhones}
            waReplyPhone={demo.waReplyPhone}
            setWaReplyPhone={demo.setWaReplyPhone}
            waReplyMsg={demo.waReplyMsg}
            setWaReplyMsg={demo.setWaReplyMsg}
            waNote={demo.waNote}
            onInvite={() => void demo.inviteWhatsApp()}
            onSimulateReply={() => void demo.simulateWhatsAppReply()}
            onResearchCall={() => void demo.researchCall()}
          />
        )}
      </div>
    </Section>
  );
}
