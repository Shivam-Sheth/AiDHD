"use client";

import type { PlaceReview } from "@/components/PlacesMap";

export function fmtClock(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function fmtDay(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function durationLabel(depart: string, arrive: string) {
  const a = new Date(depart).getTime();
  const b = new Date(arrive).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  const mins = Math.round((b - a) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function SourcePill({ source }: { source?: string }) {
  const live =
    source === "duffel" || source === "ticketmaster" || source === "linq";
  const label =
    source === "duffel"
      ? "Live · Duffel"
      : source === "ticketmaster"
        ? "Live · Ticketmaster"
        : source === "fixture"
          ? "Demo data"
          : source || "Lookup";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        live
          ? "bg-[var(--cyan)]/15 text-[var(--cyan)]"
          : "bg-[var(--accent-soft)] text-[var(--inkmute)]"
      }`}
    >
      {label}
    </span>
  );
}

export function FlightOfferCard({
  airline,
  airlineLogo,
  from,
  to,
  depart,
  arrive,
  cabin,
  price,
  priceSuffix = "/pp",
}: {
  airline: string;
  airlineLogo?: string | null;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  cabin?: string;
  price: number;
  priceSuffix?: string;
}) {
  const dur = durationLabel(depart, arrive);
  return (
    <article className="offer-card group overflow-hidden transition duration-300 hover:-translate-y-0.5">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-center gap-3 sm:w-40 sm:shrink-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            {airlineLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={airlineLogo} alt="" className="h-7 w-7 object-contain" />
            ) : (
              <span className="font-display text-[11px] font-bold text-neutral-800">
                {airline.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">
              {airline}
            </p>
            <p className="text-[11px] capitalize text-[var(--inkmute)]">
              {cabin || "Economy"}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
                {fmtClock(depart)}
              </p>
              <p className="mt-0.5 text-sm font-medium text-[var(--inksoft)]">
                {from}
              </p>
              <p className="text-[11px] text-[var(--inkmute)]">{fmtDay(depart)}</p>
            </div>
            <div className="flex min-w-[5.5rem] flex-col items-center px-1">
              <p className="text-[10px] font-medium text-[var(--inkmute)]">
                {dur || "Direct"}
              </p>
              <div className="relative mt-1.5 h-px w-full bg-[var(--edgehot)]">
                <span className="absolute top-1/2 right-0 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border-t border-r border-[var(--inkmute)]" />
              </div>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--cyan)]">
                Nonstop
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
                {fmtClock(arrive)}
              </p>
              <p className="mt-0.5 text-sm font-medium text-[var(--inksoft)]">
                {to}
              </p>
              <p className="text-[11px] text-[var(--inkmute)]">{fmtDay(arrive)}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--edge)] pt-3 sm:w-28 sm:shrink-0 sm:flex-col sm:items-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
          <div className="text-right">
            <p className="font-display text-2xl font-semibold tabular-nums text-[var(--ink)]">
              ${Math.round(price)}
            </p>
            <p className="text-[11px] text-[var(--inkmute)]">{priceSuffix}</p>
          </div>
          <span className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-[11px] font-semibold text-[var(--btn-fg)] opacity-90 transition group-hover:opacity-100">
            Select
          </span>
        </div>
      </div>
    </article>
  );
}

export function StayOfferCard({
  name,
  photo,
  neighborhood,
  nights,
  rating,
  reviewCount,
  reviewRank,
  price,
  checkIn,
  checkOut,
  highlighted,
  reviews,
  onMouseEnter,
  onMouseLeave,
}: {
  name: string;
  photo?: string | null;
  neighborhood?: string;
  nights?: number;
  rating?: number | null;
  reviewCount?: number | null;
  reviewRank?: number | null;
  price: number;
  checkIn?: string;
  checkOut?: string;
  highlighted?: boolean;
  reviews?: PlaceReview[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <article
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`offer-card group overflow-hidden transition duration-300 hover:-translate-y-1 ${
        highlighted ? "ring-2 ring-[var(--cyan)]/50" : ""
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--abyss)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--inkmute)]">
            Stay photo
          </div>
        )}
        {reviewRank === 1 && (
          <span className="absolute top-3 left-3 rounded-full bg-[var(--ink)]/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[var(--btn-fg)] uppercase backdrop-blur">
            Guest favorite
          </span>
        )}
        {rating != null && (
          <span className="absolute top-3 right-3 rounded-full bg-[var(--panel)]/95 px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] shadow-sm backdrop-blur">
            ★ {rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-[var(--ink)]">
              {name}
            </p>
            <p className="mt-1 text-sm text-[var(--inkmute)]">
              {[neighborhood, nights != null ? `${nights} nights` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-semibold text-[var(--ink)]">
              ${Math.round(price)}
            </p>
            <p className="text-[11px] text-[var(--inkmute)]">total</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--inkmute)]">
          {reviewCount != null && (
            <span>{reviewCount.toLocaleString()} reviews</span>
          )}
          {checkIn && checkOut && (
            <span>
              {checkIn} → {checkOut}
            </span>
          )}
        </div>
        {!!reviews?.length && (
          <div className="mt-3 space-y-1.5 border-t border-[var(--edge)] pt-3">
            {reviews.slice(0, 1).map((r, i) => (
              <p key={i} className="text-xs leading-relaxed text-[var(--inksoft)]">
                <span className="font-medium text-[var(--ink)]">{r.author}</span>
                {r.rating != null && ` · ★${r.rating}`}
                {r.text && ` — “${r.text}”`}
              </p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function PlaceOfferCard({
  photo,
  title,
  meta,
  price,
  priceSuffix,
  highlighted,
  reviews,
  onMouseEnter,
  onMouseLeave,
}: {
  photo?: string | null;
  title: string;
  meta: string;
  price: number;
  priceSuffix?: string;
  highlighted?: boolean;
  reviews?: PlaceReview[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <article
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`offer-card group flex overflow-hidden transition duration-300 hover:-translate-y-0.5 ${
        highlighted ? "ring-2 ring-[var(--cyan)]/40" : ""
      }`}
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden bg-[var(--abyss)] sm:h-32 sm:w-36">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-[var(--inkmute)]">
            Photo
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center p-3.5">
        <p className="truncate font-display text-sm font-semibold text-[var(--ink)]">
          {title}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--inkmute)]">
          {meta}
        </p>
        <p className="mt-2 font-display text-lg font-semibold text-[var(--ink)]">
          ${Math.round(price)}
          {priceSuffix && (
            <span className="ml-0.5 text-[10px] font-medium text-[var(--inkmute)]">
              {priceSuffix}
            </span>
          )}
        </p>
        {!!reviews?.length && (
          <p className="mt-1.5 line-clamp-1 text-[11px] text-[var(--inksoft)]">
            ★ {reviews[0]?.rating ?? "—"} · {reviews[0]?.author}
          </p>
        )}
      </div>
    </article>
  );
}
