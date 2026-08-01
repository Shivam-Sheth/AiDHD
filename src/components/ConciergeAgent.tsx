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

type FlightCard = {
  id: string;
  airline: string;
  airline_logo_url?: string | null;
  from: string;
  to: string;
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
  photo_url?: string | null;
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

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(11, 16) || iso;
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function sourceBadge(source?: string) {
  const live =
    source === "duffel" || source === "ticketmaster" || source === "linq";
  const label =
    source === "duffel"
      ? "Live · Duffel"
      : source === "ticketmaster"
        ? "Live · Ticketmaster"
        : source === "fixture"
          ? "Fixture"
          : source || "Lookup";
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        live
          ? "bg-emerald-100 text-emerald-900"
          : "bg-stone-200/80 text-stone-700"
      }`}
    >
      {label}
    </span>
  );
}

function FlightRow({ f }: { f: FlightCard }) {
  return (
    <article className="pixel-panel group relative overflow-hidden p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[var(--cyan)]/40">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 bg-[var(--cyan)]" />
        <span className="label text-[var(--cyan)]">Flight</span>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--edge)] bg-white">
          {f.airline_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={f.airline_logo_url}
              alt=""
              className="h-8 w-8 object-contain"
            />
          ) : (
            <span className="font-display text-[0.45rem] text-[#0b3d38]">
              {f.airline.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-[0.62rem] text-[var(--ink)]">
              {f.airline}
            </p>
            <p className="font-display text-[0.85rem] tabular-nums text-[var(--amber)]">
              ${Math.round(f.price_per_person)}
              <span className="ml-0.5 text-[10px] font-medium text-[var(--inkmute)]">
                /pp
              </span>
            </p>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div>
              <p className="font-display text-[1rem] tracking-tight text-[var(--ink)]">
                {f.from}
              </p>
              <p className="text-xs text-[var(--inkmute)]">{fmtTime(f.depart)}</p>
            </div>
            <div className="flex flex-col items-center px-1">
              <div className="h-px w-10 bg-gradient-to-r from-transparent via-[var(--cyan)]/70 to-transparent" />
              <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--inkmute)]">
                {f.cabin}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-[1rem] tracking-tight text-[var(--ink)]">
                {f.to}
              </p>
              <p className="text-xs text-[var(--inkmute)]">{fmtTime(f.arrive)}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ReviewsBlock({ reviews }: { reviews?: PlaceReview[] }) {
  if (!reviews?.length) return null;
  return (
    <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
        Google reviews
      </p>
      {reviews.slice(0, 2).map((r, i) => (
        <p key={i} className="text-xs leading-relaxed text-white/55">
          <span className="font-semibold text-white/70">{r.author}</span>
          {r.rating != null && <span className="text-amber-200"> · ★{r.rating}</span>}
          {r.text && <span> — {r.text}</span>}
        </p>
      ))}
    </div>
  );
}

function MediaCard({
  photo,
  title,
  meta,
  price,
  priceSuffix,
  onMouseEnter,
  onMouseLeave,
  highlighted,
  reviews,
}: {
  photo?: string | null;
  title: string;
  meta: string;
  price: number;
  priceSuffix?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  highlighted?: boolean;
  reviews?: PlaceReview[];
}) {
  return (
    <article
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`flex overflow-hidden border bg-[var(--panel)]/90 transition ${
        highlighted ? "border-[var(--amber)]/60" : "border-[var(--edge)]"
      }`}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-28 w-28 shrink-0 object-cover" />
      )}
      <div className="flex flex-1 flex-col justify-center p-3">
        <p className="font-display text-[0.62rem] text-[var(--ink)]">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--inkmute)]">{meta}</p>
        <p className="mt-2 font-display text-[0.85rem] text-[var(--amber)]">
          ${Math.round(price)}
          {priceSuffix && (
            <span className="ml-0.5 text-[10px] font-medium text-[var(--inkmute)]">
              {priceSuffix}
            </span>
          )}
        </p>
        <ReviewsBlock reviews={reviews} />
      </div>
    </article>
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
      <span className="text-center text-xs font-medium text-neutral-500">{subtext}</span>
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="block rounded-2xl transition hover:bg-neutral-200/70"
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
      className={`fixed top-1/2 right-0 z-40 w-72 max-w-[85vw] -translate-y-1/2 rounded-l-3xl bg-neutral-100 px-5 py-6 text-[#12181f] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out ${
        info ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {info && (
        <div className="divide-y divide-neutral-200">
          <p className="pb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Hotel → {info.place}
          </p>
          <div className="flex flex-col items-center gap-1 py-4">
            <p
              className={`font-display text-5xl font-bold ${fast ? "text-green-600" : "text-orange-500"}`}
            >
              {info.drive_minutes ?? "—"}
            </p>
            <p className="text-xs font-medium text-neutral-500">minutes</p>
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
      const res = await fetch("/api/prava/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: payment.payload.session_id,
          merchant: payment.payload.merchant,
          amount: payment.payload.amount,
          category: payment.payload.category || "trip",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setVoiceError(data.error || "Prava couldn't confirm this payment.");
        return;
      }
      if (data.ui) pushUi(data.ui as UiCard);
      setLines((prev) => [
        ...prev,
        { role: "assistant", text: data.summary || `Confirmed ${data.confirmation_id}.` },
      ]);
    } catch (e) {
      setVoiceError(
        e instanceof Error ? e.message : "Could not complete Prava checkout",
      );
    } finally {
      setCompleting(false);
    }
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
        const res = await fetch("/api/agent/tools", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-aidhd-session": sessionRef.current,
          },
          body: JSON.stringify({
            tool_name: name,
            parameters,
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
      <section className="flex min-h-[70vh] flex-col">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">
          Live concierge
        </p>
        <h1 className="font-display mt-3 max-w-lg text-[2.65rem] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
          AiDHD
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/65">
          Flights, hotels, dinner, clubs, movies, tickets — options land as
          cards here. When you&apos;re ready, Prava opens for payment.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {conversation.status !== "connected" ? (
            <button
              type="button"
              onClick={startVoice}
              className="rounded-2xl bg-amber-300 px-5 py-3 font-display text-sm font-semibold text-[#142019] shadow-[0_10px_30px_-12px_rgba(251,191,36,0.7)] transition hover:bg-amber-200"
            >
              Start voice
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVoice}
              className="rounded-2xl border border-rose-300/40 bg-rose-500/15 px-5 py-3 font-display text-sm font-semibold text-rose-100"
            >
              End · {conversation.isSpeaking ? "speaking" : "listening"}
            </button>
          )}
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              live
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/5 text-white/50"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? "animate-pulse bg-emerald-300" : "bg-white/30"
              }`}
            />
            {live ? "Mic live" : "Text anytime"}
          </span>
        </div>
        {voiceError && (
          <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {voiceError}
          </p>
        )}

        <div className="mt-8 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c1117]/70 shadow-inner backdrop-blur-md">
          <div className="max-h-[380px] flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {lines.length === 0 && (
              <p className="text-sm leading-relaxed text-white/45">
                Try: “Flights Chicago → NYC Aug 11–15” · “Dinner in Chicago” ·
                “Clubs in Brooklyn” · “Movies tonight” · “Hotels in Bali”
              </p>
            )}
            {lines.map((l, i) => (
              <div
                key={`${i}-${l.text.slice(0, 16)}`}
                className={`max-w-[92%] animate-[fade-in_0.35s_ease] ${
                  l.role === "user" ? "ml-auto text-right" : ""
                }`}
              >
                <span className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                  {l.role === "user" ? "You" : "AiDHD"}
                </span>
                <p
                  className={`mt-1 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    l.role === "user"
                      ? "bg-amber-300/15 text-amber-50"
                      : "bg-white/5 text-white/85"
                  }`}
                >
                  {l.text}
                </p>
              </div>
            ))}
          </div>
          <form
            onSubmit={sendText}
            className="flex gap-2 border-t border-white/10 p-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask for flights, dinner, clubs, movies…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/15"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="rounded-xl bg-white px-4 py-3 font-display text-sm font-semibold text-[#0c1117] disabled:opacity-40"
            >
              {pending ? "…" : "Send"}
            </button>
          </form>
        </div>
      </section>

      <aside className="space-y-5">
        {payment && (
          <div className="animate-[slide-up_0.4s_ease] overflow-hidden rounded-3xl border border-amber-300/25 bg-gradient-to-br from-amber-400/15 to-[#12181f] p-4 shadow-[0_20px_50px_-24px_rgba(251,191,36,0.45)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-sm font-semibold text-amber-100">
                  Prava checkout
                </p>
                <p className="mt-1 text-sm text-white/70">
                  ${payment.payload.amount.toFixed(2)} ·{" "}
                  {payment.payload.merchant}
                </p>
              </div>
              <span className="rounded-md bg-amber-300/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-100">
                {payment.payload.mode}
              </span>
            </div>
            {payment.payload.session_token &&
            payment.payload.iframe_url &&
            pravaPublishableKey ? (
              <>
                <div
                  ref={cardContainerRef}
                  className="mt-3 min-h-[220px] w-full overflow-hidden rounded-2xl bg-white"
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
                    className="mt-3 inline-flex rounded-xl bg-amber-300 px-3 py-2 text-sm font-semibold text-[#142019]"
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
                  className="mt-3 w-full rounded-xl bg-amber-300 px-3 py-2.5 font-display text-sm font-semibold text-[#142019] disabled:opacity-50"
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
          <div className="animate-[slide-up_0.4s_ease] rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <p className="font-display text-sm font-semibold text-emerald-100">
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
            <h2 className="font-display text-lg font-bold text-white">
              Results
            </h2>
            <p className="text-[11px] text-white/40">
              Cards appear when tools run
            </p>
          </div>

          {recommendedPlaces.length > 0 && (
            <div className="mb-5">
              <PlacesMap
                apiKey={googleMapsApiKey}
                places={recommendedPlaces}
                hoveredId={hoveredPlaceId}
                variant="dark"
                onResolved={(id, info) =>
                  setPlaceReviews((prev) => ({ ...prev, [id]: info.reviews }))
                }
                onRouteInfo={setRouteInfo}
              />
            </div>
          )}

          {cards.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-10 text-center">
              <p className="font-display text-sm font-medium text-white/55">
                Waiting for a lookup
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/35">
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
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                        {c.payload.label || "Flights"}
                      </p>
                      {sourceBadge(c.payload.source)}
                      {c.payload.google_flights_url && (
                        <a
                          href={c.payload.google_flights_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200 hover:bg-white/15"
                        >
                          Open Google Flights
                        </a>
                      )}
                    </div>
                    {outbound.map((f) => (
                      <FlightRow key={f.id} f={f} />
                    ))}
                    {inbound.length > 0 && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/80">
                            {c.payload.return_label || "Return"}
                          </p>
                          {sourceBadge(
                            c.payload.return_source || c.payload.source,
                          )}
                        </div>
                        {inbound.map((f) => (
                          <FlightRow key={`ret-${f.id}`} f={f} />
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
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                        Stays · {c.payload.label || "by reviews"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((h) => (
                      <article
                        key={h.id}
                        onMouseEnter={() => setHoveredPlaceId(`hotels-${h.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `hotels-${h.id}` ? null : id,
                          )
                        }
                        className={`overflow-hidden rounded-2xl border bg-[#12181f]/90 transition ${
                          hoveredPlaceId === `hotels-${h.id}`
                            ? "border-amber-300/60"
                            : "border-white/10"
                        }`}
                      >
                        {h.photo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={h.photo_url}
                            alt=""
                            className="h-28 w-full object-cover"
                          />
                        )}
                        <div className="p-4">
                          <div className="flex justify-between gap-2">
                            <p className="font-display text-sm font-semibold text-white">
                              #{h.review_rank} {h.name}
                            </p>
                            <p className="font-display text-lg font-bold text-amber-300">
                              ${Math.round(h.price_total)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-white/50">
                            {h.rating != null && (
                              <span className="font-semibold text-amber-200">
                                ★ {h.rating.toFixed(1)}
                              </span>
                            )}
                            {h.review_count != null && (
                              <span> · {h.review_count} reviews</span>
                            )}
                            {" · "}
                            {h.neighborhood} · {h.nights}n
                          </p>
                          <ReviewsBlock reviews={placeReviews[`hotels-${h.id}`]} />
                        </div>
                      </article>
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
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                        {c.payload.label || "Tickets"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((t) => (
                      <MediaCard
                        key={t.id}
                        photo={t.photo_url}
                        title={t.event_name}
                        meta={`${t.venue} · ${t.date}`}
                        price={t.price}
                        onMouseEnter={() => setHoveredPlaceId(`tickets-${t.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `tickets-${t.id}` ? null : id,
                          )
                        }
                        highlighted={hoveredPlaceId === `tickets-${t.id}`}
                        reviews={placeReviews[`tickets-${t.id}`]}
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
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                        Dinner · {c.payload.label || "picks"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((d) => (
                      <MediaCard
                        key={d.id}
                        photo={d.photo_url}
                        title={d.name}
                        meta={`${d.cuisine} · ${d.neighborhood} · ${fmtTime(d.time)}`}
                        price={d.price_per_person}
                        priceSuffix="/pp"
                        onMouseEnter={() => setHoveredPlaceId(`dining-${d.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `dining-${d.id}` ? null : id,
                          )
                        }
                        highlighted={hoveredPlaceId === `dining-${d.id}`}
                        reviews={placeReviews[`dining-${d.id}`]}
                      />
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
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                        Clubs · {c.payload.label || "nightlife"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((cl) => (
                      <MediaCard
                        key={cl.id}
                        photo={cl.photo_url}
                        title={cl.name}
                        meta={`${cl.vibe} · ${cl.neighborhood} · until ${cl.open_until}`}
                        price={cl.cover}
                        priceSuffix=" cover"
                        onMouseEnter={() => setHoveredPlaceId(`clubs-${cl.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `clubs-${cl.id}` ? null : id,
                          )
                        }
                        highlighted={hoveredPlaceId === `clubs-${cl.id}`}
                        reviews={placeReviews[`clubs-${cl.id}`]}
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
                      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                        Movies · {c.payload.label || "showtimes"}
                      </p>
                      {sourceBadge(c.payload.source)}
                    </div>
                    {c.payload.offers.slice(0, 4).map((m) => (
                      <MediaCard
                        key={m.id}
                        photo={m.photo_url}
                        title={m.title}
                        meta={`${m.rating} · ${m.theater} · ${m.showtimes.join(" · ")}`}
                        price={m.price}
                        onMouseEnter={() => setHoveredPlaceId(`movies-${m.id}`)}
                        onMouseLeave={() =>
                          setHoveredPlaceId((id) =>
                            id === `movies-${m.id}` ? null : id,
                          )
                        }
                        highlighted={hoveredPlaceId === `movies-${m.id}`}
                        reviews={placeReviews[`movies-${m.id}`]}
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
                    className="animate-[slide-in-left_0.5s_ease] overflow-hidden rounded-2xl border border-white/10 bg-[#12181f]/90 p-4 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.55)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {w.icon_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={w.icon_url} alt="" className="h-10 w-10" />
                        )}
                        <div>
                          <p className="font-display text-sm font-semibold text-white">
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
                      <p className="font-display text-lg font-bold text-amber-300">
                        {w.mode === "forecast"
                          ? `${Math.round(w.temp_high ?? 0)}°/${Math.round(w.temp_low ?? 0)}°`
                          : `${Math.round(w.temperature ?? 0)}°F`}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-white/70">{w.condition}</p>
                    <p
                      className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                        w.extreme
                          ? "bg-orange-500 text-white"
                          : "bg-green-600 text-white"
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

        <p className="text-center text-[11px] text-white/30">
          Prefer a reel?{" "}
          <Link
            href="/reel"
            className="text-amber-200/70 underline-offset-2 hover:underline"
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
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--void)] text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 site-atmosphere" />
        <div className="absolute inset-[-12%] site-stars" />
        <div className="absolute inset-x-0 bottom-0 h-[40vh] site-grid-floor" />
      </div>
      <header className="mx-auto flex max-w-6xl items-baseline justify-between px-5 pt-8 sm:px-6">
        <Link
          href="/"
          className="font-display text-[0.7rem] tracking-widest text-[var(--ink)] transition-colors hover:text-[var(--cyan)]"
        >
          AiDHD<span className="text-[var(--cyan)]">.APP</span>
        </Link>
        <div className="flex gap-5 text-sm text-[var(--inkmute)]">
          <Link href="/reel" className="transition hover:text-[var(--cyan)]">
            Reel → plan
          </Link>
          <Link href="/" className="transition hover:text-[var(--cyan)]">
            Demo
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
