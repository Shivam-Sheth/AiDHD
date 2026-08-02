"use client";

import { MapPin, Star, Utensils, Music2, Film, Hotel, Ticket } from "lucide-react";
import clsx from "clsx";
import type { PlaceReview } from "@/components/PlacesMap";

type Kind = "hotel" | "dining" | "club" | "movie" | "ticket";

const ICONS = {
  hotel: Hotel,
  dining: Utensils,
  club: Music2,
  movie: Film,
  ticket: Ticket,
};

export function VenueTicket({
  kind,
  title,
  meta,
  price,
  priceSuffix,
  photo,
  rating,
  reviewCount,
  badge,
  highlighted,
  reviews,
  onMouseEnter,
  onMouseLeave,
}: {
  kind: Kind;
  title: string;
  meta: string;
  price: number;
  priceSuffix?: string;
  photo?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  badge?: string;
  highlighted?: boolean;
  reviews?: PlaceReview[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const Icon = ICONS[kind];

  return (
    <article
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(
        "flex overflow-hidden rounded-2xl border bg-surface shadow-card transition duration-300 hover:-translate-y-0.5",
        highlighted ? "border-ink" : "border-line",
      )}
    >
      <div className="min-w-0 flex-1">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-32 w-full object-cover" />
        ) : (
          <div className="flex h-20 items-center justify-center bg-subtle">
            <Icon className="h-7 w-7 text-ink/70" aria-hidden />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {badge && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink">
                  {badge}
                </p>
              )}
              <h3 className="font-display mt-0.5 truncate text-lg font-semibold text-ink">
                {title}
              </h3>
              <p className="mt-1 flex items-start gap-1 text-xs leading-relaxed text-muted">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {meta}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-xl font-bold tabular-nums text-ink">
                ${Math.round(price)}
              </p>
              {priceSuffix && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                  {priceSuffix}
                </p>
              )}
            </div>
          </div>

          {(rating != null || reviewCount != null) && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-ink">
              <Star className="h-3.5 w-3.5 fill-ink text-ink" aria-hidden />
              {rating != null && rating.toFixed(1)}
              {reviewCount != null && (
                <span className="text-muted"> · {reviewCount} reviews</span>
              )}
            </p>
          )}

          {reviews && reviews.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
              {reviews.slice(0, 2).map((r, i) => (
                <p key={i} className="text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-ink">{r.author}</span>
                  {r.rating != null && (
                    <span className="text-ink"> · ★{r.rating}</span>
                  )}
                  {r.text && <span> — {r.text}</span>}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className={clsx(
          "flex w-14 shrink-0 flex-col items-center justify-between border-l border-dashed border-line px-1.5 py-4 text-inverse sm:w-16",
          kind === "dining" || kind === "hotel"
            ? "bg-ink"
            : "bg-ink-800",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
        <p
          className="text-[9px] font-semibold tracking-[0.22em] uppercase"
          style={{ writingMode: "vertical-rl" }}
        >
          AiDHD
        </p>
        <div
          aria-hidden
          className="h-10 w-2.5 opacity-45"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, currentColor 0 2px, transparent 2px 5px)",
          }}
        />
      </div>
    </article>
  );
}
