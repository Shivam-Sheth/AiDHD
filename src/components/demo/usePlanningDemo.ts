"use client";

import { useCallback, useEffect, useState } from "react";
import type { PackageData, Snapshot } from "@/lib/types-client";
import { EVENT_ID, TRIP_EVENT_ID, j, phaseFrom, type Phase } from "@/lib/client/api";

export { EVENT_ID, TRIP_EVENT_ID };
export type { Phase };

export function usePlanningDemo() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [waPhones, setWaPhones] = useState("");
  const [waReplyPhone, setWaReplyPhone] = useState("+17735411355");
  const [waReplyMsg, setWaReplyMsg] = useState("PLAN");
  const [waNote, setWaNote] = useState<string | null>(null);
  const [eventId, setEventIdState] = useState(EVENT_ID);
  const [voiceClip, setVoiceClip] = useState<string | null>(null);
  const [failTicketDemo, setFailTicketDemo] = useState(false);

  const refresh = useCallback(async () => {
    const data = await j<Snapshot>(`/api/events/${eventId}`);
    setSnap(data);
    return data;
  }, [eventId]);

  useEffect(() => {
    void (async () => {
      try {
        await j("/api/demo/reset", { method: "POST" });
        const [health, data] = await Promise.all([
          j<{ integrations: Record<string, string> }>("/api/health"),
          j<Snapshot>(`/api/events/${eventId}`),
        ]);
        setIntegrations(health.integrations);
        setSnap(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [eventId]);

  const phase: Phase = phaseFrom(snap);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something failed");
    } finally {
      setBusy(false);
    }
  }

  function setEventId(id: string) {
    setEventIdState(id);
    setSelected(null);
    setVoiceClip(null);
  }

  async function startDemo() {
    await run(async () => {
      await j("/api/demo/seed-responses", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId }),
      });
      await j(`/api/events/${eventId}/reconcile`, { method: "POST" });
    });
  }

  async function inviteWhatsApp() {
    const phones = waPhones
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!phones.length) {
      setWaNote("Add at least one +1… number (must be a Meta test recipient).");
      return;
    }
    setBusy(true);
    setError(null);
    setWaNote(null);
    try {
      const res = await j<{
        invited: string[];
        failed?: { phone: string; error: string }[];
        tip?: string;
      }>("/api/channels/whatsapp/invite", {
        method: "POST",
        body: JSON.stringify({ phones }),
      });
      const failBit =
        res.failed?.length ?
          ` Failed: ${res.failed.map((f) => f.phone).join(", ")} (must be Meta-allowed with +1…).`
        : "";
      setWaNote(
        `Invited ${res.invited.length}. They get Meta hello_world first. Ask them to reply "hi" — then Pact sends the planning intro (Meta blocks freeform until they reply).${failBit} ${res.tip ?? ""}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "WhatsApp invite failed");
    } finally {
      setBusy(false);
    }
  }

  /** Bypass Meta webhook — types a reply as if it came from WhatsApp. */
  async function simulateWhatsAppReply() {
    setBusy(true);
    setError(null);
    setWaNote(null);
    try {
      const res = await j<{ replies: string[] }>("/api/channels/whatsapp/simulate", {
        method: "POST",
        body: JSON.stringify({ phone: waReplyPhone, message: waReplyMsg }),
      });
      setWaNote(
        `Bot replied on WhatsApp (${res.replies.length} msg). If phone was quiet, Meta webhook URL may be stale — use this box meanwhile.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setBusy(false);
    }
  }

  async function researchCall() {
    setBusy(true);
    setError(null);
    try {
      const res = await j<{ job: { id: string; findings?: string; status: string } }>(
        "/api/agents/research-call",
        {
          method: "POST",
          body: JSON.stringify({
            venue_name: "Miami Go-Karts",
            venue_phone: "+13055550100",
            question: "What's the height limit for drivers?",
            reply_to_phone: waReplyPhone,
            simulate: true,
          }),
        },
      );
      setWaNote(`Research ${res.job.status}: ${res.job.findings ?? res.job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  async function choosePlan(pkg: PackageData) {
    setSelected(pkg.id);
    await run(async () => {
      // Casts all 3 demo-roster votes at once to simulate instant group consensus —
      // the real backend still requires every invitee's vote before it auto-resolves a winner.
      for (const u of snap?.users ?? []) {
        await j(`/api/events/${eventId}/vote`, {
          method: "POST",
          body: JSON.stringify({ package_id: pkg.id, user_id: u.id }),
        });
      }
      await j(`/api/events/${eventId}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "request", package_id: pkg.id }),
      });
    });
  }

  async function payAndBook() {
    await run(async () => {
      await j(`/api/events/${eventId}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "approve_all" }),
      });
      const bookRes = await j<{
        results?: Array<{ voice?: { audio_url?: string; script?: string } }>;
      }>(`/api/events/${eventId}/book`, {
        method: "POST",
        body: JSON.stringify({ fail_ticket: failTicketDemo }),
      });
      const voice = bookRes.results?.find((r) => r.voice)?.voice;
      if (voice?.audio_url) setVoiceClip(voice.audio_url);
      else if (voice?.script) setWaNote(`Voice script: ${voice.script}`);
    });
  }

  /** Demonstrates the per-category partial-failure story: re-request only the failed leg's mandate. */
  async function rerequestFailedMandate() {
    await run(async () => {
      await j(`/api/events/${eventId}/book`, {
        method: "POST",
        body: JSON.stringify({ action: "rerequest_failed" }),
      });
      await j(`/api/events/${eventId}/mandates`, {
        method: "POST",
        body: JSON.stringify({ action: "approve_all" }),
      });
      await j(`/api/events/${eventId}/book`, { method: "POST", body: JSON.stringify({}) });
    });
  }

  async function resetDemo() {
    setSelected(null);
    setVoiceClip(null);
    await run(async () => {
      await j("/api/demo/reset", { method: "POST" });
    });
  }

  const chosen =
    snap?.packages.find((p) => p.id === selected || p.id === snap.event.selected_package_id) ?? null;

  const bookings = snap?.bookings ?? [];
  const confirmedCategories = new Set(bookings.filter((b) => b.status === "confirmed").map((b) => b.category));
  // A category can appear twice (original failure + successful re-mandate) — only surface the
  // failure banner while that category still has no confirmed booking to supersede it.
  const failedBooking =
    bookings.find((b) => b.status === "failed" && !confirmedCategories.has(b.category)) ?? null;

  return {
    snap,
    integrations,
    busy,
    error,
    phase,
    chosen,
    eventId,
    setEventId,
    voiceClip,
    waPhones,
    setWaPhones,
    waReplyPhone,
    setWaReplyPhone,
    waReplyMsg,
    setWaReplyMsg,
    waNote,
    failTicketDemo,
    setFailTicketDemo,
    failedBooking,
    startDemo,
    choosePlan,
    payAndBook,
    resetDemo,
    inviteWhatsApp,
    simulateWhatsAppReply,
    researchCall,
    rerequestFailedMandate,
  };
}
