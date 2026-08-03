"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Fixed native-pixel layout for the wallet + tickets scene. Kept as constants
// (rather than fluid %) so the "tucked under the wallet" masking math stays
// exact — the whole scene is scaled down as one unit on narrower viewports
// via useSceneScale rather than reflowing.
//
// Both tickets sit fully stacked (same position) behind the wallet — their
// hidden main panels fully overlap. Only their stubs differ, offset
// side-by-side so they peek out next to each other. Opening a ticket slides
// its main panel and its stub independently: the main panel clears the
// wallet to the right, and the stub slides further right to sit flush
// against it again, re-forming one continuous card.
const MAIN_W = 340;
const STUB_W = 96;
const WALLET_W = MAIN_W;
const TICKET_H = 420;
const REST_MAIN_LEFT = 0;
const OPEN_MAIN_LEFT = WALLET_W;
const OPEN_STUB_LEFT = WALLET_W + MAIN_W;
const SCENE_W = OPEN_STUB_LEFT + STUB_W;
const SCENE_H = TICKET_H;
const WALLET_Z = 40;
const MAIN_REST_Z = 25; // hidden behind the wallet
const STUB_REST_Z = 25; // above the wallet, visible while idle
const ACTIVE_Z = 40; // the open ticket wins over the wallet AND the other ticket's resting stub
const HIT_Z_CLOSED = 50; // invisible hover/focus target, above all visuals
const HIT_Z_OPEN = 60; // wins over the other ticket's closed hit-area when open

function CartIcon({ color }: { color: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function StorefrontIcon({ color }: { color: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9 5 4h14l1 5" />
      <path d="M4 9v10a1 1 0 0 0 1 1h4v-6h6v6h4a1 1 0 0 0 1-1V9" />
      <path d="M4 9h16" />
    </svg>
  );
}

/** Scales the fixed-px wallet scene down to fit narrow viewports, reusing
 * the same ResizeObserver scale-to-fit technique as GroupPlanningAnimation
 * so the whole composition (wallet + both tickets) shrinks as one unit
 * instead of overflowing or needing horizontal scroll on mobile. */
function useSceneScale() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setScale(w / SCENE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { containerRef, scale };
}

function Barcode({ tint }: { tint: string }) {
  const bars = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  return (
    <div className="flex items-end gap-[3px]" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2.5px]"
          style={{ height: 10 + h * 2, backgroundColor: tint }}
        />
      ))}
    </div>
  );
}

/** The single leather wallet both tickets share — a fixed mask sitting above
 * both tickets' main panels in the stacking order, so each one is only
 * visible once it has physically slid clear of the wallet's footprint. One
 * pocket, one opening — the tickets' stubs emerge from it side by side. */
function Wallet() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 overflow-hidden rounded-[22px]"
      style={{
        width: WALLET_W,
        height: TICKET_H,
        zIndex: WALLET_Z,
        background:
          "linear-gradient(135deg, #7a4a2c 0%, #5c3620 45%, #3a2113 100%)",
        boxShadow:
          "0 24px 48px -16px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.08)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25" />
      <div className="absolute inset-[10px] rounded-[14px] border border-dashed border-[#d9b98a]/25" />
      {/* Slot shadow where the tickets emerge. */}
      <div className="absolute top-3 bottom-3 right-0 w-10 bg-gradient-to-l from-black/50 to-transparent" />
      <span className="font-display absolute bottom-5 left-6 text-[11px] tracking-[0.35em] text-white/25 uppercase">
        Pact
      </span>
    </div>
  );
}

function TicketCard({
  stubRestOffset,
  eyebrow,
  eyebrowColor,
  title,
  description,
  bullets,
  stubBg,
  stubBorder,
  labelColor,
  barcodeTint,
  stubLabel,
  icon,
  idx,
}: {
  /** Extra px the stub sits right of the wallet's edge at rest, so two
   * tickets' stubs can sit side by side instead of overlapping. */
  stubRestOffset: number;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  description: string;
  bullets: string[];
  stubBg: string;
  stubBorder: string;
  labelColor: string;
  barcodeTint: string;
  stubLabel: string;
  icon: ReactNode;
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  const restStubLeft = WALLET_W + stubRestOffset;
  const stubTranslate = open ? OPEN_STUB_LEFT - restStubLeft * 0.9 + 1.2 * idx * (STUB_W) : 0;
  const mainTranslate = open ? OPEN_MAIN_LEFT - REST_MAIN_LEFT + idx * (STUB_W) : 0;

  // The hover/focus target is a separate, non-animating hit-area rather than
  // the stub or main panel themselves. The stub is only 96px wide but can
  // travel 200+px when opening — if the pointer stayed fixed while the stub
  // slid out from under it, the stub would exit the cursor mid-transition,
  // firing mouseleave, snapping it back, re-entering, and oscillating
  // forever. Snapping this hit-area's bounds to the target state immediately
  // (no transition) keeps the pointer "inside" it for the whole animation.
  const handlers = {
    tabIndex: 0,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onClick: () => setOpen((v) => !v),
  };

  return (
    <>
      <div
        {...handlers}
        className="absolute top-0 cursor-pointer rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-2)]"
        style={{
          left: open ? OPEN_MAIN_LEFT : restStubLeft,
          width: open ? MAIN_W + STUB_W : STUB_W,
          height: TICKET_H,
          zIndex: open ? HIT_Z_OPEN : HIT_Z_CLOSED,
        }}
      />

      {/* Main panel — hidden behind the wallet at rest, slides right to
          clear it and reveal the copy. */}
      <div
        className="absolute top-0 left-0 rounded-3xl transition-transform duration-500 ease-in-out"
        style={{
          width: MAIN_W,
          height: TICKET_H,
          zIndex: MAIN_REST_Z - idx * 10,
          transform: `translateX(${mainTranslate}px)`,
        }}
      >
        <div
          className={`h-full w-full overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-xl shadow-black/20 `}
        >
          <p
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: eyebrowColor }}
          >
            {eyebrow}
          </p>
          <h3 className="font-display mt-2 text-2xl font-semibold text-[var(--ink)]">
            {title}
          </h3>
          <p className="mt-3 leading-relaxed text-[var(--muted)]">{description}</p>
          <div className="mt-5 border-t border-dashed border-[var(--line)]" />
          <ul className="mt-4 space-y-1.5 text-sm text-[var(--muted)]">
            {bullets.map((bullet) => (
              <li key={bullet}>· {bullet}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Stub — always visible, sits next to the other ticket's stub at
          rest and slides over to rejoin the main panel when open. */}
      <div
        className="absolute top-0 rounded-3xl transition-transform duration-500 ease-in-out"
        style={{
          left: restStubLeft * 0.9 - idx * (STUB_W * 0.2),
          width: STUB_W,
          height: TICKET_H,
          zIndex: STUB_REST_Z - idx * 10,
          transform: `translateX(${stubTranslate}px)`,
        }}
      >
        <div
          className="relative flex h-full w-full flex-col items-center justify-between rounded-3xl border-l-2 border-dashed py-6 shadow-xl shadow-black/20"
          style={{ backgroundColor: stubBg, borderColor: stubBorder }}
        >
          {icon}
          <span
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 text-[10px] font-semibold tracking-[0.25em] whitespace-nowrap uppercase"
            style={{ color: labelColor }}
          >
            {stubLabel}
          </span>
          <Barcode tint={barcodeTint} />
        </div>
      </div>
    </>
  );
}

function WalletScene() {
  const { containerRef, scale } = useSceneScale();

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full"
      style={{ maxWidth: SCENE_W, height: SCENE_H * scale }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: SCENE_W, height: SCENE_H, transform: `scale(${scale})` }}
      >
        <Wallet />

        <TicketCard
          stubRestOffset={0}
          eyebrow="For friends"
          eyebrowColor="var(--coral)"
          title="Shop the drop together"
          description="Join a friend's group, drop items in your cart, and watch the countdown and threshold bar move live. The agent recommends picks that fit your budget and help the group unlock the discount."
          bullets={[
            "Live countdown + threshold bar",
            "Agent-recommended picks",
            "One prava checkout when it's time",
          ]}
          stubBg="var(--night)"
          stubBorder="rgba(255,255,255,0.8)"
          labelColor="rgba(255,255,255,0.85)"
          barcodeTint="rgba(255,255,255,0.25)"
          stubLabel="Pact · Friends"
          icon={<CartIcon color="var(--coral)" />}
          idx={0}
        />

        <TicketCard
          stubRestOffset={STUB_W}
          eyebrow="For brands"
          eyebrowColor="var(--accent)"
          title="Plug in a live discount event"
          description="Shopify brands set a discount, a spend threshold, and a countdown window — the platform and prava handle invites, recommendations, and checkout. Same storefront, bigger basket size."
          bullets={[
            "Set discount + threshold + window",
            "Agent drives basket size up",
            "prava settles checkout, per order",
          ]}
          stubBg="var(--wallet-brand)"
          stubBorder="rgba(255,255,255,0.8)"
          labelColor="rgba(255,255,255,0.9)"
          barcodeTint="rgba(255,255,255,0.3)"
          stubLabel="Pact · Brands"
          icon={<StorefrontIcon color="var(--accent-soft)" />}
          idx={1}
        />
      </div>
    </div>
  );
}

export function TripsOutings() {
  return (
    <section
      id="use-cases"
      className="border-t border-[var(--line)] bg-[var(--surface-2)] bg-grid-pattern py-20 lg:py-24"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-center text-3xl font-bold text-[var(--ink)] sm:text-4xl">
          Same drop. Two sides of the counter.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--muted)]">
          Whether you&apos;re shopping with friends or running the drop, the
          mechanics are the same: invite → recommend → cross the threshold →
          checkout via prava.
        </p>
        <p className="mt-2 text-center text-xs text-[var(--faint)]">
          Hover a pass to pull it out of the wallet.
        </p>

        <div className="mt-14">
          <WalletScene />
        </div>
      </div>
    </section>
  );
}
