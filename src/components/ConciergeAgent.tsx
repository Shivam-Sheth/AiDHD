"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { PravaSDK } from "@prava-sdk/core";
import {
  PlacesMap,
  type MapPlace,
  type PlaceReview,
  type RouteInfoPayload,
} from "@/components/PlacesMap";
import { FlightTicket } from "@/components/booking/FlightTicket";
import { VenueTicket } from "@/components/booking/VenueTicket";
import { SampleMandates } from "@/components/booking/SampleMandates";
import { PassportGate } from "@/components/vault/PassportGate";

type FlightCard = {
  id: string;
  airline: string;
  airline_logo_url?: string | null;
  airline_iata?: string | null;
  flight_number?: string;
  duration?: string;
  stops?: number;
  from: string;
  from_city?: string;
  to: string;
  to_city?: string;
  depart: string;
  arrive: string;
  cabin: string;
  price_per_person: number;
  source: string;
};

type HotelCard = {
  id: string;
  name: string;
  neighborhood: string;
  nights: number;
  price_total: number;
  rating?: number | null;
  review_count?: number | null;
  review_rank?: number | null;
  check_in: string;
  check_out: string;
  photo_url?: string | null;
  source?: string;
};

type TicketCard = {
  id: string;
  event_name: string;
  venue: string;
  date: string;
  price: number;
  photo_url?: string | null;
  source?: string;
};

type DiningCard = {
  id: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  time: string;
  price_per_person: number;
  party_size?: number;
  photo_url?: string | null;
  rating?: number;
  review_count?: number;
  source?: string;
};

type ClubCard = {
  id: string;
  name: string;
  neighborhood: string;
  vibe: string;
  cover: number;
  open_until: string;
  photo_url?: string | null;
  rating?: number;
  review_count?: number;
  source?: string;
};

type MovieCard = {
  id: string;
  title: string;
  theater: string;
  neighborhood: string;
  showtimes: string[];
  price: number;
  rating: string;
  photo_url?: string | null;
  source?: string;
};

type UiCard =
  | {
      kind: "flights";
      payload: {
        offers: FlightCard[];
        return_offers?: FlightCard[];
        label?: string;
        return_label?: string;
        source?: string;
        return_source?: string;
        google_flights_url?: string;
      };
    }
  | {
      kind: "hotels";
      payload: { offers: HotelCard[]; label?: string; source?: string };
    }
  | {
      kind: "tickets";
      payload: { offers: TicketCard[]; label?: string; source?: string };
    }
  | {
      kind: "dining";
      payload: { offers: DiningCard[]; label?: string; source?: string };
    }
  | {
      kind: "clubs";
      payload: { offers: ClubCard[]; label?: string; source?: string };
    }
  | {
      kind: "movies";
      payload: { offers: MovieCard[]; label?: string; source?: string };
    }
  | {
      kind: "payment";
      payload: {
        session_id: string;
        /** Required by @prava-sdk/core's collectPAN() — not present in mock mode. */
        session_token?: string;
        iframe_url?: string;
        pay_url?: string | null;
        amount: number;
        merchant: string;
        mode: string;
        category?: string;
        offer_id?: string;
        user_id?: string;
      };
    }
  | {
      kind: "receipt";
      payload: {
        confirmation_id: string;
        session_id: string;
        mandate_id: string;
        token_ref: string;
        merchant: string;
        amount: number;
        mode: string;
        summary: string;
      };
    }
  | { kind: "vendor"; payload: unknown }
  | {
      kind: "weather";
      payload: {
        mode: "forecast" | "current";
        place: string;
        date: string;
        condition: string;
        icon_url: string | null;
        temp_high?: number;
        temp_low?: number;
        temperature?: number;
        unit: string;
        extreme: boolean;
        source: string;
      };
    }
  | { kind: "message"; payload: { text?: string } };

type ChatLine = { role: "user" | "assistant"; text: string };

function sourceBadge(source?: string) {
  const live =
    source === "duffel" ||
    source === "ticketmaster" ||
    source === "linq" ||
    source === "google_places";
  const label =
    source === "duffel"
      ? "Live · Duffel"
      : source === "google_places"
        ? "Live · Places"
        : source === "ticketmaster"
          ? "Live · Ticketmaster"
          : source === "fixture"
            ? "Demo inventory"
            : source || "Lookup";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        live
          ? "bg-success-soft text-success"
          : "bg-line/80 text-muted"
      }`}
    >
      {label}
    </span>
  );
}

function RouteRow({
  icon,
  subtext,
  href,
}: {
  icon: string;
  subtext: string;
  href?: string;
}) {
  const body = (
    <div className="flex flex-col items-center gap-1.5 py-3">
      <span className="text-3xl leading-none">{icon}</span>
      <span className="text-center text-xs font-medium text-muted">{subtext}</span>
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl transition hover:bg-line/70"
      >
        {body}
      </a>
    );
  }
  return body;
}

/** Slides in from the right edge once a route to a hovered place is ready. */
function RoutePanel({ info }: { info: RouteInfoPayload | null }) {
  const fast = (info?.drive_minutes ?? 999) < 30;
  return (
    <div
      className={`fixed top-1/2 right-0 z-40 w-72 max-w-[85vw] -translate-y-1/2 rounded-l-3xl bg-subtle px-5 py-6 text-ink shadow-lifted transition-transform duration-300 ease-out ${
        info ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {info && (
        <div className="divide-y divide-line">
          <p className="pb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-faint">
            Hotel → {info.place}
          </p>
          <div className="flex flex-col items-center gap-1 py-4">
            <p
              className={`font-display text-5xl font-bold ${fast ? "text-success" : "text-warning"}`}
            >
              {info.drive_minutes ?? "—"}
            </p>
            <p className="text-xs font-medium text-muted">minutes</p>
          </div>
          <RouteRow
            icon="🚶"
            subtext={info.walk_minutes != null ? `${info.walk_minutes} min walk` : "Not available"}
          />
          <RouteRow
            icon="🚴"
            subtext={info.bike_minutes != null ? `${info.bike_minutes} min bike` : "Not available"}
          />
          <RouteRow
            icon="🚗"
            subtext={info.drive_minutes != null ? `${info.drive_minutes} min drive` : "Not available"}
          />
          <RouteRow
            icon="🚆"
            subtext={info.transit_minutes != null ? `${info.transit_minutes} min train` : "Not available"}
          />
          <RouteRow icon="🔗" subtext="Check info on maps" href={info.maps_url} />
        </div>
      )}
    </div>
  );
}

function ConciergeInner({
  googleMapsApiKey,
  pravaPublishableKey,
}: {
  googleMapsApiKey: string | null;
  pravaPublishableKey: string | null;
}) {
  const reactId = useId();
  const sessionRef = useRef(
    `sess_${reactId.replace(/:/g, "")}_${Date.now().toString(36)}`,
  );
  const sinceRef = useRef(0);
  const seenKeys = useRef(new Set<string>());
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const collectedSessionRef = useRef<string | null>(null);

  const [cards, setCards] = useState<UiCard[]>([]);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [payment, setPayment] = useState<(UiCard & { kind: "payment" }) | null>(
    null,
  );
  const [receipt, setReceipt] = useState<
    (UiCard & { kind: "receipt" }) | null
  >(null);
  const [completing, setCompleting] = useState(false);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [passportOpen, setPassportOpen] = useState(false);
  const pendingBookRef = useRef<Record<string, unknown> | null>(null);

  /**
   * Flights are a route, not a point on a map — every other card kind has a place to geocode.
   * `cards` is newest-first, so the first hotels card we see is the most recent search; its
   * top-ranked (by reviews) offer becomes the map's anchor hotel — there's no explicit
   * "pick a room" action in this UI yet, so the best-ranked stay stands in for "chosen."
   */
  const recommendedPlaces = useMemo<MapPlace[]>(() => {
    const byId = new Map<string, MapPlace>();
    let anchorId: string | null = null;
    for (const c of cards) {
      if (c.kind === "hotels") {
        const city = c.payload.label || "";
        for (const h of c.payload.offers) {
          const id = `hotels-${h.id}`;
          byId.set(id, { id, label: h.name, query: `${h.name}, ${h.neighborhood}, ${city}` });
        }
        if (!anchorId && c.payload.offers.length) {
          const top =
            c.payload.offers.find((h) => h.review_rank === 1) || c.payload.offers[0];
          anchorId = `hotels-${top.id}`;
        }
      } else if (c.kind === "dining") {
        const city = c.payload.label || "";
        for (const d of c.payload.offers) {
          const id = `dining-${d.id}`;
          byId.set(id, { id, label: d.name, query: `${d.name}, ${d.neighborhood}, ${city}` });
        }
      } else if (c.kind === "clubs") {
        const city = c.payload.label || "";
        for (const cl of c.payload.offers) {
          const id = `clubs-${cl.id}`;
          byId.set(id, { id, label: cl.name, query: `${cl.name}, ${cl.neighborhood}, ${city}` });
        }
      } else if (c.kind === "movies") {
        const city = c.payload.label || "";
        for (const m of c.payload.offers) {
          const id = `movies-${m.id}`;
          byId.set(id, {
            id,
            label: m.theater,
            query: `${m.theater}, ${m.neighborhood}, ${city}`,
          });
        }
      } else if (c.kind === "tickets") {
        const city = (c.payload.label || "").split(" · ").pop() || "";
        for (const t of c.payload.offers) {
          const id = `tickets-${t.id}`;
          byId.set(id, { id, label: t.venue, query: `${t.venue}, ${city}` });
        }
      }
    }
    if (anchorId && byId.has(anchorId)) {
      byId.set(anchorId, { ...byId.get(anchorId)!, isAnchor: true });
    }
    return [...byId.values()];
  }, [cards]);

  const [placeReviews, setPlaceReviews] = useState<Record<string, PlaceReview[]>>({});
  const [routeInfo, setRouteInfo] = useState<RouteInfoPayload | null>(null);

  const pushUi = useCallback((ui: UiCard | UiCard[] | undefined | null) => {
    if (!ui) return;
    const list = Array.isArray(ui) ? ui : [ui];
    setCards((prev) => [...list, ...prev].slice(0, 16));
    for (const c of list) {
      if (c.kind === "payment") setPayment(c);
      if (c.kind === "receipt") setReceipt(c);
    }
  }, []);

  /** Fires once @prava-sdk/core's collectPAN() resolves — polls payment-result + reports status server-side. */
  async function completePayment() {
    if (!payment) return;
    setCompleting(true);
    try {
      let userId = payment.payload.user_id;
      if (!userId) {
        try {
          const { readLocalGroupUser } = await import(
            "@/lib/groups/client-session"
          );
          userId = readLocalGroupUser()?.id;
        } catch {
          /* optional */
        }
      }
      const res = await fetch("/api/prava/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: payment.payload.session_id,
          merchant: payment.payload.merchant,
          amount: payment.payload.amount,
          category: payment.payload.category || "trip",
          offer_id: payment.payload.offer_id,
          user_id: userId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setVoiceError(data.error || "Prava couldn't confirm this payment.");
        return;
      }
      if (data.needs_passport && payment.payload.offer_id) {
        pendingBookRef.current = {
          offer_id: payment.payload.offer_id,
          user_id: userId,
        };
        setPassportOpen(true);
      }
      if (data.ui) pushUi(data.ui as UiCard);
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.summary || `Confirmed ${data.confirmation_id}.`,
        },
      ]);
      setPayment(null);
    } catch (e) {
      setVoiceError(
        e instanceof Error ? e.message : "Could not complete Prava checkout",
      );
    } finally {
      setCompleting(false);
    }
  }

  async function bookFlightOffer(f: FlightCard) {
    const amount = Math.round(f.price_per_person);
    const summary = await runTool("create_payment", {
      merchant: `${f.airline} ${f.from}→${f.to}`,
      amount,
      category: "flight",
      offer_id: f.id,
    });
    setLines((prev) => [
      ...prev,
      {
        role: "assistant",
        text: String(summary || `Prava open for $${amount} — complete Collect, then we issue the ticket.`),
      },
    ]);
  }

  async function reserveDiningOffer(d: DiningCard, city?: string) {
    let spoc = "Guest";
    try {
      const { readLocalGroupUser } = await import(
        "@/lib/groups/client-session"
      );
      spoc = readLocalGroupUser()?.name || spoc;
    } catch {
      /* optional */
    }
    const summary = await runTool("confirm_dining_reservation", {
      restaurant: d.name,
      offer_id: d.id,
      spoc_name: spoc,
      party_size: d.party_size || 2,
      time: d.time,
      cuisine: d.cuisine,
      neighborhood: d.neighborhood || city,
    });
    setLines((prev) => [
      ...prev,
      { role: "assistant", text: String(summary) },
    ]);
  }

  /** Mounts the real Prava card-collection iframe via the SDK — a bare <iframe src> isn't a supported integration. */
  useEffect(() => {
    if (
      !payment?.payload.session_token ||
      !payment.payload.iframe_url ||
      !pravaPublishableKey ||
      !cardContainerRef.current
    ) {
      return;
    }
    if (collectedSessionRef.current === payment.payload.session_id) return;
    collectedSessionRef.current = payment.payload.session_id;

    const sdk = new PravaSDK({ publishableKey: pravaPublishableKey });
    void sdk.collectPAN({
      sessionToken: payment.payload.session_token,
      iframeUrl: payment.payload.iframe_url,
      container: cardContainerRef.current,
      onSuccess: () => void completePayment(),
      onError: (err) =>
        setVoiceError(`Card entry failed: ${err.message || err.code}`),
    });

    return () => sdk.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.payload.session_id, pravaPublishableKey]);

  const runTool = useCallback(
    async (name: string, parameters: Record<string, unknown>) => {
      try {
        // Inject vault user id from party session when the LLM omits it
        let params = { ...parameters };
        if (
          (name === "check_passport_vault" ||
            name === "confirm_flight_booking" ||
            name === "create_payment") &&
          !params.user_id
        ) {
          try {
            const { readLocalGroupUser } = await import(
              "@/lib/groups/client-session"
            );
            const local = readLocalGroupUser();
            if (local?.id) params = { ...params, user_id: local.id };
          } catch {
            /* optional */
          }
        }
        const res = await fetch("/api/agent/tools", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-aidhd-session": sessionRef.current,
          },
          body: JSON.stringify({
            tool_name: name,
            parameters: params,
            client_session: sessionRef.current,
          }),
        });
        const data = await res.json();
        if (data.ui) pushUi(data.ui as UiCard);
        return (
          data.result ||
          data.summary ||
          (data.ok === false
            ? `Tool ${name} failed: ${data.error || "unknown"}`
            : JSON.stringify(data))
        );
      } catch (e) {
        // Never throw into ElevenLabs — unhandled client-tool errors drop the call
        return `Tool ${name} failed: ${e instanceof Error ? e.message : "network error"}. Tell the user briefly and offer to retry.`;
      }
    },
    [pushUi],
  );

  useConversationClientTool("show_results", async (params) => {
    pushUi({
      kind: "message",
      payload: { text: String((params as { message?: string }).message || "") },
    });
    return "Shown on screen";
  });
  useConversationClientTool("search_flights", async (params) =>
    runTool("search_flights", params as Record<string, unknown>),
  );
  useConversationClientTool("search_hotels", async (params) =>
    runTool("search_hotels", params as Record<string, unknown>),
  );
  useConversationClientTool("search_tickets", async (params) =>
    runTool("search_tickets", params as Record<string, unknown>),
  );
  useConversationClientTool("search_dining", async (params) =>
    runTool("search_dining", params as Record<string, unknown>),
  );
  useConversationClientTool("search_clubs", async (params) =>
    runTool("search_clubs", params as Record<string, unknown>),
  );
  useConversationClientTool("search_movies", async (params) =>
    runTool("search_movies", params as Record<string, unknown>),
  );
  useConversationClientTool("lookup_vendor", async (params) =>
    runTool("lookup_vendor", params as Record<string, unknown>),
  );
  useConversationClientTool("get_weather", async (params) =>
    runTool("get_weather", params as Record<string, unknown>),
  );
  useConversationClientTool("create_payment", async (params) =>
    runTool("create_payment", params as Record<string, unknown>),
  );
  useConversationClientTool("check_passport_vault", async (params) =>
    runTool("check_passport_vault", params as Record<string, unknown>),
  );
  useConversationClientTool("confirm_flight_booking", async (params) => {
    const result = await runTool(
      "confirm_flight_booking",
      params as Record<string, unknown>,
    );
    const text = String(result || "");
    if (/passport needed|passport missing|PassportGate/i.test(text)) {
      pendingBookRef.current = params as Record<string, unknown>;
      setPassportOpen(true);
      return "Passport form is on screen — remember encrypted or use once. Never ask them to speak the number. After they continue, retry confirm_flight_booking.";
    }
    return result;
  });
  useConversationClientTool("confirm_dining_reservation", async (params) =>
    runTool("confirm_dining_reservation", params as Record<string, unknown>),
  );

  const conversation = useConversation({
    onConnect: () => setVoiceError(null),
    onDisconnect: (details) => {
      const d = details as {
        reason?: string;
        message?: string;
        closeReason?: string;
        closeCode?: number;
      };
      if (d?.reason === "error" || d?.closeCode) {
        setVoiceError(
          d.closeReason ||
            d.message ||
            "Voice session dropped — tap Start voice to reconnect.",
        );
      }
      setVoiceReady(false);
    },
    onError: (err) =>
      setVoiceError(
        typeof err === "string"
          ? err
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Voice error — try Start voice again",
      ),
    onMessage: (msg) => {
      const m = msg as { source?: string; message?: string; role?: string };
      const text = m.message || "";
      if (!text) return;
      const role: ChatLine["role"] =
        m.source === "user" || m.role === "user" ? "user" : "assistant";
      setLines((prev) => [...prev, { role, text }].slice(-40));
    },
    onAgentToolResponse: (res) => {
      const r = res as { tool_name?: string; result?: unknown };
      if (
        typeof r.result === "object" &&
        r.result &&
        "ui" in (r.result as object)
      ) {
        pushUi((r.result as { ui: UiCard }).ui);
      }
    },
  });

  // Backup poll — helps when a tool publishes to the UI bus (same instance / text path)
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const convId =
          conversation.status === "connected" ? conversation.getId?.() : "";
        const q = new URLSearchParams({
          session: sessionRef.current,
          since: String(sinceRef.current),
        });
        if (convId) q.set("conversation_id", convId);
        const res = await fetch(`/api/agent/ui-feed?${q}`);
        const data = await res.json();
        if (cancelled || !data.items?.length) return;
        for (const item of data.items as Array<{
          kind: string;
          payload: unknown;
          at: number;
          tool?: string;
        }>) {
          const key = `${item.at}:${item.kind}:${item.tool || ""}`;
          if (seenKeys.current.has(key)) continue;
          seenKeys.current.add(key);
          sinceRef.current = Math.max(sinceRef.current, item.at);
          pushUi({ kind: item.kind, payload: item.payload } as UiCard);
        }
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, 1500);
    tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [conversation, pushUi]);

  async function startVoice() {
    setVoiceError(null);
    try {
      const res = await fetch("/api/agent/signed-url");
      const data = await res.json();
      if (!res.ok || data.voice === false) {
        setVoiceError(
          data.error ||
            "Voice needs ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID. Text chat still works.",
        );
        return;
      }
      if (data.signed_url) {
        conversation.startSession({ signedUrl: data.signed_url });
      } else {
        conversation.startSession({ agentId: data.agent_id });
      }
      setVoiceReady(true);
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Could not start voice");
    }
  }

  function stopVoice() {
    conversation.endSession();
    setVoiceReady(false);
  }

  function sendText(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setLines((prev) => [...prev, { role: "user", text }]);

    if (conversation.status === "connected") {
      conversation.sendUserMessage(text);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            messages: lines.map((l) => ({
              role: l.role,
              content: l.text,
            })),
          }),
        });
        const data = await res.json();
        if (data.ui) pushUi(data.ui as UiCard[]);
        setLines((prev) => [
          ...prev,
          { role: "assistant", text: data.reply || data.error || "…" },
        ]);
      } catch (err) {
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            text: err instanceof Error ? err.message : "Chat failed",
          },
        ]);
      }
    });
  }

  const live = voiceReady || conversation.status === "connected";

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 pb-28 pt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] sm:px-6">
      <PassportGate
        open={passportOpen}
        onClose={() => setPassportOpen(false)}
        onReady={() => {
          const pending = pendingBookRef.current;
          if (pending) {
            void runTool("confirm_flight_booking", pending).then((summary) => {
              setLines((prev) => [
                ...prev,
                { role: "assistant", text: String(summary) },
              ]);
            });
          }
        }}
      />
      <section className="flex min-h-[70vh] flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink">
          Live concierge
        </p>
        <h1 className="font-display mt-3 max-w-lg text-[2.65rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          AiDHD
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
          Flights, hotels, dinner, clubs, movies, tickets — options land as
          boarding-pass cards. Map + weather join when Places is live. Pay with
          Prava when you&apos;re ready.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {conversation.status !== "connected" ? (
            <button
              type="button"
              onClick={startVoice}
              className="rounded-lg bg-ink px-5 py-3 font-display text-sm font-semibold text-inverse shadow-card transition-colors hover:bg-ink-800"
            >
              Start voice
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVoice}
              className="rounded-lg border border-danger/30 bg-danger-soft px-5 py-3 font-display text-sm font-semibold text-danger"
            >
              End · {conversation.isSpeaking ? "speaking" : "listening"}
            </button>
          )}
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              live
                ? "border-success/30 bg-success-soft text-success"
                : "border-line bg-surface text-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? "animate-pulse bg-success" : "bg-faint"
              }`}
            />
            {live ? "Mic live" : "Text anytime"}
          </span>
        </div>
        {voiceError && (
          <p className="mt-3 rounded-xl border border-warning/30 bg-ink/15 px-3 py-2 text-sm text-ink">
            {voiceError}
          </p>
        )}

        <div className="mt-8 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
          <div className="max-h-[380px] flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {lines.length === 0 && (
              <p className="text-sm leading-relaxed text-muted">
                Try: “Flights Chicago → NYC Aug 11–15” · “Dinner in Chicago” ·
                “Clubs in Brooklyn” · “Hotels in Bali”
              </p>
            )}
            {lines.map((l, i) => (
              <div
                key={`${i}-${l.text.slice(0, 16)}`}
                className={`max-w-[92%] animate-fade-in ${
                  l.role === "user" ? "ml-auto text-right" : ""
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
                  {l.role === "user" ? "You" : "AiDHD"}
                </span>
                <p
                  className={`mt-1 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    l.role === "user"
                      ? "bg-ink/15 text-ink"
                      : "bg-canvas text-ink"
                  }`}
                >
                  {l.text}
                </p>
              </div>
            ))}
          </div>
          <form
            onSubmit={sendText}
            className="flex gap-2 border-t border-line p-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask for flights, dinner, clubs, movies…"
              className="focus-ring flex-1 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="rounded-xl bg-ink px-4 py-3 font-display text-sm font-semibold text-canvas disabled:opacity-40"
            >
              {pending ? "…" : "Send"}
            </button>
          </form>
        </div>
      </section>

      <aside className="space-y-5">
        <SampleMandates />
        {payment && (
          <div className="animate-[slide-up_0.4s_ease] overflow-hidden rounded-3xl border border-warning/25 bg-ink p-4 shadow-lifted">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-sm font-semibold text-warning-soft">
                  Prava checkout
                </p>
                <p className="mt-1 text-sm text-white/70">
                  ${payment.payload.amount.toFixed(2)} ·{" "}
                  {payment.payload.merchant}
                </p>
              </div>
              <span className="rounded-md bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning-soft">
                {payment.payload.mode}
              </span>
            </div>
            {payment.payload.session_token &&
            payment.payload.iframe_url &&
            pravaPublishableKey ? (
              <>
                <div
                  ref={cardContainerRef}
                  className="mt-3 min-h-[220px] w-full overflow-hidden rounded-2xl bg-surface"
                />
                <p className="mt-2 text-[11px] text-white/45">
                  {completing
                    ? "Finalizing…"
                    : "Enter your card above — booking completes automatically once approved (passkey may be requested)."}
                </p>
              </>
            ) : (
              <>
                {payment.payload.pay_url ? (
                  <a
                    href={payment.payload.pay_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-xl bg-warning px-3 py-2 text-sm font-semibold text-inverse"
                  >
                    Open Prava
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-white/55">
                    Session {payment.payload.session_id}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-white/45">
                  {pravaPublishableKey
                    ? "Approve passkey / card here — the agent can't finish that by voice alone."
                    : "Add PRAVA_PUBLISHABLE_KEY to collect a real card — this session is running mock/demo checkout."}
                </p>
                <button
                  type="button"
                  disabled={completing}
                  onClick={() => void completePayment()}
                  className="mt-3 w-full rounded-xl bg-warning px-3 py-2.5 font-display text-sm font-semibold text-inverse disabled:opacity-50"
                >
                  {completing
                    ? "Finalizing…"
                    : "I approved Collect — complete booking"}
                </button>
              </>
            )}
          </div>
        )}

        {receipt && (
          <div className="animate-[slide-up_0.4s_ease] rounded-3xl border border-success/30 bg-success/10 p-4">
            <p className="font-display text-sm font-semibold text-success-soft">
              Transaction complete
            </p>
            <p className="mt-1 text-sm text-white/80">
              {receipt.payload.confirmation_id} · $
              {receipt.payload.amount.toFixed(2)} ·{" "}
              {receipt.payload.merchant}
            </p>
            <p className="mt-2 text-xs text-white/50">
              Mandate {receipt.payload.mandate_id} · token{" "}
              {receipt.payload.token_ref} · {receipt.payload.mode}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              {receipt.payload.summary}
            </p>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              Results
            </h2>
            <p className="text-[11px] text-faint">
              Cards appear when tools run
            </p>
          </div>

          {recommendedPlaces.length > 0 && (
            <div className="mb-5">
              <PlacesMap
                apiKey={googleMapsApiKey}
                places={recommendedPlaces}
                hoveredId={hoveredPlaceId}
                variant="light"
                onResolved={(id, info) =>
                  setPlaceReviews((prev) => ({ ...prev, [id]: info.reviews }))
                }
                onRouteInfo={setRouteInfo}
              />
            </div>
          )}

          {cards.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line bg-surface px-5 py-10 text-center">
              <p className="font-display text-sm font-medium text-muted">
                Waiting for a lookup
              </p>
              <p className="mt-2 text-xs leading-relaxed text-faint">
                Flight, hotel, dinner, club, movie, and ticket cards show up
                here the moment the agent searches.
              </p>
            </div>
          )}

          <div className="space-y-5">
            {cards.map((c, idx) => {
              if (c.kind === "flights") {
                const outbound = c.payload.offers.slice(0, 4);
                const inbound = (c.payload.return_offers || []).slice(0, 4);
                return (
                  <div
                    key={`f-${idx}`}
                    className="animate-[fade-in_0.4s_ease] space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                        {c.payload.label || "Flights"}
                      </p>
                      {sourceBadge(c.payload.source)}
                      {c.payload.google_flights_url && (
                        <a
                          href={c.payload.google_flights_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-line hover:bg-white/15"
                        >
                          Open Google Flights
                        </a>
                      )}
                    </div>
                    {outbound.map((f) => (
                      <div key={f.id} className="space-y-2">
                        <FlightTicket f={f} />
                        <button
                          type="button"
                          onClick={() => void bookFlightOffer(f)}
                          className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink"
                        >
                          Book · ${Math.round(f.price_per_person)}/pp via Prava
                        </button>
                      </div>
                    ))}
                    {inbound.length > 0 && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink-800">
                            {c.payload.return_label || "Return"}
                          </p>
                          {sourceBadge(
                            c.payload.return_source || c.payload.source,
                          )}
                        </div>
                        {inbound.map((f) => (
                          <div key={`ret-${f.id}`} className="space-y-2">
                            <FlightTicket f={f} />
                            <button
                              type="button"
                              onClick={() => void bookFlightOffer(f)}
                              className="w-full rounded-xl border border-accent/50 bg-accent/10 py-2.5 text-sm font-semibold text-ink"
                            >
                              Book return · ${Math.round(f.price_per_person)}/pp
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              }
              if (c.kind === "hotels") {
                return (
                  <div
                    key={`h-${idx}`}
                    className="animate-[fade-in_0.4s_ease] space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                        Stays · {c.payload.label || "by reviews"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((h) => (
                      <VenueTicket
                        key={h.id}
                        kind="hotel"
                        badge={h.review_rank ? `#${h.review_rank}` : "Stay"}
                        title={h.name}
                        meta={`${h.neighborhood} · ${h.nights} night${h.nights === 1 ? "" : "s"} · ${h.check_in} → ${h.check_out}`}
                        price={h.price_total}
                        priceSuffix="total"
                        photo={h.photo_url}
                        rating={h.rating}
                        reviewCount={h.review_count}
                        highlighted={hoveredPlaceId === `hotels-${h.id}`}
                        reviews={placeReviews[`hotels-${h.id}`]}
                        onMouseEnter={() => setHoveredPlaceId(`hotels-${h.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `hotels-${h.id}` ? null : id,
                          )
                        }
                      />
                    ))}
                  </div>
                );
              }
              if (c.kind === "tickets") {
                return (
                  <div
                    key={`t-${idx}`}
                    className="animate-[fade-in_0.4s_ease] space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                        {c.payload.label || "Tickets"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((t) => (
                      <VenueTicket
                        key={t.id}
                        kind="ticket"
                        title={t.event_name}
                        meta={`${t.venue} · ${t.date}`}
                        price={t.price}
                        photo={t.photo_url}
                        highlighted={hoveredPlaceId === `tickets-${t.id}`}
                        reviews={placeReviews[`tickets-${t.id}`]}
                        onMouseEnter={() => setHoveredPlaceId(`tickets-${t.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `tickets-${t.id}` ? null : id,
                          )
                        }
                      />
                    ))}
                  </div>
                );
              }
              if (c.kind === "dining") {
                return (
                  <div
                    key={`d-${idx}`}
                    className="animate-[fade-in_0.4s_ease] space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                        Dinner · {c.payload.label || "picks"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((d) => (
                      <div key={d.id} className="space-y-2">
                        <VenueTicket
                          kind="dining"
                          title={d.name}
                          meta={`${d.cuisine} · ${d.neighborhood}`}
                          price={d.price_per_person}
                          priceSuffix="/pp"
                          photo={d.photo_url}
                          rating={d.rating}
                          reviewCount={d.review_count}
                          highlighted={hoveredPlaceId === `dining-${d.id}`}
                          reviews={placeReviews[`dining-${d.id}`]}
                          onMouseEnter={() =>
                            setHoveredPlaceId(`dining-${d.id}`)
                          }
                          onMouseLeave={() =>
                            setHoveredPlaceId((id) =>
                              id === `dining-${d.id}` ? null : id,
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void reserveDiningOffer(d, c.payload.label)
                          }
                          className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-inverse"
                        >
                          Reserve table · under your name
                        </button>
                      </div>
                    ))}
                  </div>
                );
              }
              if (c.kind === "clubs") {
                return (
                  <div
                    key={`c-${idx}`}
                    className="animate-[fade-in_0.4s_ease] space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                        Clubs · {c.payload.label || "nightlife"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((cl) => (
                      <VenueTicket
                        key={cl.id}
                        kind="club"
                        title={cl.name}
                        meta={`${cl.vibe} · ${cl.neighborhood} · until ${cl.open_until}`}
                        price={cl.cover}
                        priceSuffix="cover"
                        photo={cl.photo_url}
                        rating={cl.rating}
                        reviewCount={cl.review_count}
                        highlighted={hoveredPlaceId === `clubs-${cl.id}`}
                        reviews={placeReviews[`clubs-${cl.id}`]}
                        onMouseEnter={() => setHoveredPlaceId(`clubs-${cl.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `clubs-${cl.id}` ? null : id,
                          )
                        }
                      />
                    ))}
                  </div>
                );
              }
              if (c.kind === "movies") {
                return (
                  <div
                    key={`m-${idx}`}
                    className="animate-[fade-in_0.4s_ease] space-y-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                        Movies · {c.payload.label || "showtimes"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((m) => (
                      <VenueTicket
                        key={m.id}
                        kind="movie"
                        title={m.title}
                        meta={`${m.rating} · ${m.theater} · ${m.showtimes.join(" · ")}`}
                        price={m.price}
                        photo={m.photo_url}
                        highlighted={hoveredPlaceId === `movies-${m.id}`}
                        reviews={placeReviews[`movies-${m.id}`]}
                        onMouseEnter={() => setHoveredPlaceId(`movies-${m.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `movies-${m.id}` ? null : id,
                          )
                        }
                      />
                    ))}
                  </div>
                );
              }
              if (c.kind === "weather") {
                const w = c.payload;
                return (
                  <div
                    key={`w-${idx}`}
                    className="animate-[slide-in-left_0.5s_ease] overflow-hidden rounded-2xl border border-white/10 bg-ink/90 p-4 shadow-card"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {w.icon_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={w.icon_url} alt="" className="h-10 w-10" />
                        )}
                        <div>
                          <p className="font-display text-sm font-semibold text-inverse">
                            {w.place}
                          </p>
                          <p className="text-xs text-white/50">
                            {w.mode === "forecast" ? "Forecast" : "Current"} ·{" "}
                            {new Date(`${w.date}T00:00:00`).toLocaleDateString(
                              "en-US",
                              { weekday: "short", month: "short", day: "numeric" },
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="font-display text-lg font-bold text-warning">
                        {w.mode === "forecast"
                          ? `${Math.round(w.temp_high ?? 0)}°/${Math.round(w.temp_low ?? 0)}°`
                          : `${Math.round(w.temperature ?? 0)}°F`}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-white/70">{w.condition}</p>
                    <p
                      className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                        w.extreme
                          ? "bg-warning text-inverse"
                          : "bg-success text-inverse"
                      }`}
                    >
                      {w.extreme
                        ? "Observe caution - Extreme weather forecasted"
                        : "Weather forecast looks good"}
                    </p>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>

        <p className="text-center text-[11px] text-faint">
          Prefer a reel?{" "}
          <Link
            href="/reel"
            className="text-ink underline-offset-2 hover:underline"
          >
            Paste Instagram → plan
          </Link>
        </p>
      </aside>

      <RoutePanel info={routeInfo} />
    </div>
  );
}

export function ConciergeAgent({
  googleMapsApiKey,
  pravaPublishableKey,
}: {
  googleMapsApiKey: string | null;
  pravaPublishableKey: string | null;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-canvas text-ink">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "var(--color-canvas)",
        }}
      />
      <header className="mx-auto flex max-w-6xl items-baseline justify-between px-5 pt-8 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight text-ink transition hover:text-ink"
        >
          AiDHD
        </Link>
        <div className="flex gap-5 text-sm text-muted">
          <Link href="/events/new" className="transition hover:text-ink">
            Plan event
          </Link>
          <Link href="/reel" className="transition hover:text-ink">
            Reel → plan
          </Link>
          <Link href="/" className="transition hover:text-ink">
            Home
          </Link>
        </div>
      </header>
      <ConversationProvider>
        <ConciergeInner
          googleMapsApiKey={googleMapsApiKey}
          pravaPublishableKey={pravaPublishableKey}
        />
      </ConversationProvider>
    </div>
  );
}
