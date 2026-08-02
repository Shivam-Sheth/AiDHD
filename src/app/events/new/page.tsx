"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { EventType } from "@/lib/mock/types";
import { MOCK_ORGANIZER, MOCK_INVITEE_POOL, type Persona } from "@/lib/mock/personas";
import { slugify } from "@/lib/mock/slugify";
import { useEvents } from "@/lib/mock/EventContext";
import { FlowShell } from "@/components/flow/FlowShell";
import { ModeToggle } from "@/components/flow/ModeToggle";
import { StartModeCards } from "@/components/flow/steps/StartModeCards";
import { StartDateChips } from "@/components/flow/steps/StartDateChips";
import { StartInviteeRow } from "@/components/flow/steps/StartInviteeRow";

const inputClass =
  "focus-ring w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition focus:border-ink";
const labelClass = "text-[11px] font-semibold tracking-[0.15em] text-faint uppercase";

export default function NewEventPage() {
  const router = useRouter();
  const { createEvent } = useEvents();

  const [mode, setMode] = useState<EventType>("trip");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [ticketTier, setTicketTier] = useState("");
  const [invitees, setInvitees] = useState<Persona[]>([]);

  const nextPersona = MOCK_INVITEE_POOL.find((p) => !invitees.some((i) => i.id === p.id));
  const previewSlug = slugify(title);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !place.trim() || invitees.length === 0) return false;
    if (mode === "trip") return dates.length > 0;
    return dates.length === 1;
  }, [title, place, invitees, mode, dates]);

  function handleAddInvitee() {
    if (nextPersona) setInvitees((prev) => [...prev, nextPersona]);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const proposed_dates =
      mode === "outing" && time ? [`${dates[0]}T${time}`] : dates;
    const slug = createEvent({
      type: mode,
      title: title.trim(),
      destination_or_venue: place.trim(),
      proposed_dates,
      invitees,
      organizer: MOCK_ORGANIZER,
    });
    router.push(`/e/${slug}/collect`);
  }

  return (
    <FlowShell
      step={1}
      pathOverride={`aidhd.app/e/${previewSlug}`}
      modeSlot={<ModeToggle value={mode} onChange={setMode} />}
    >
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-ink uppercase">
          New event
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">What are we planning?</h1>

        <div className="mt-6">
          <StartModeCards value={mode} onChange={setMode} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="title">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "trip" ? "Miami Long Weekend" : "Jordan's Birthday Night"}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="place">
              {mode === "trip" ? "Destination" : "Venue"}
            </label>
            <input
              id="place"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder={mode === "trip" ? "Miami, FL" : "Brooklyn Steel"}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-6">
          <label className={labelClass}>{mode === "trip" ? "Dates" : "Date"}</label>
          <div className="mt-2">
            <StartDateChips selected={dates} onChange={setDates} multiple={mode === "trip"} />
          </div>
        </div>

        {mode === "outing" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="time">
                Time
              </label>
              <input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="tier">
                Ticket tier
              </label>
              <input
                id="tier"
                value={ticketTier}
                onChange={(e) => setTicketTier(e.target.value)}
                placeholder="General admission, VIP, floor seats…"
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div className="mt-6">
          <label className={labelClass}>Who&apos;s coming</label>
          <div className="mt-2">
            <StartInviteeRow
              organizer={MOCK_ORGANIZER}
              invitees={invitees}
              canAdd={!!nextPersona}
              onAdd={handleAddInvitee}
            />
          </div>
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3.5 text-sm font-bold text-inverse transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send invites, let the chaos begin
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </FlowShell>
  );
}

