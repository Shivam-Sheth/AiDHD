"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTheme, type Theme } from "@/components/ThemeProvider";

/**
 * Looping, scene-based visualization of the group-buy flow: a brand opens a
 * live window → a friend invites the group → everyone adds items to their
 * cart → the agent recommends bundles to close the gap to the threshold →
 * bundles are ready → the group crosses the threshold and checks out →
 * the discount unlocks for everyone.
 *
 * Timing/easing/layout math is unchanged from the original trip-planning
 * version of this component — only the scene copy, data, and colors (now
 * theme-aware, see PALETTE below) moved. Inline styles (not Tailwind) are
 * used throughout on purpose: every value here is a continuously animated
 * float computed per frame from a scene clock — Tailwind's utility classes
 * are static strings resolved at build time, so they can't express a
 * per-frame opacity/transform, and a dynamically-built arbitrary-value
 * className wouldn't be picked up by Tailwind's build-time scanner anyway.
 *
 * The source ran on a general-purpose scene-sequencing engine built for a
 * video editor (host timeline sync, video export, an on-canvas scrub bar,
 * localStorage-persisted playhead, hard-cut vs. overlap transition modes).
 * None of that applies to a looping decorative embed, so only the exact
 * timing/looping math is reproduced below: a requestAnimationFrame clock
 * that wraps forever, and a scene switch that mounts exactly one scene
 * component at a time (this source never uses the engine's "overlap"
 * transition, so a hard cut is the whole behavior to preserve).
 */

// ── Palette & shared primitives ──────────────────────────────────────────────
// These four are solid fills that carry their own contrasting content on top
// (a white avatar initial, a white checkmark) — legible against either card
// theme on their own, so unlike PALETTE below they don't need a light/dark
// pair.
const AVATAR_ACCENT = "#22d3ee";
const TEAL = "#2F6F5C";
const PURPLE = "#4B4A72";
const BLUE = "#3D5A78";

// Everything that sits directly on the card surface (text, dividers, the
// card glass itself, the threshold/top-pick highlight) does need to flip
// with theme, since the surrounding hero can now be an airy light card or
// the original dark glass.
const PALETTE: Record<
  Theme,
  {
    text: string;
    muted: string;
    muted2: string;
    rowText: string;
    cardBg: string;
    cardBorder: string;
    cardShadow: string;
    divider: string;
    tagBg: string;
    tagBorder: string;
    highlightInk: string;
    successBg: string;
    successText: string;
    successBorder: string;
  }
> = {
  dark: {
    text: "#F5F4F8",
    muted: "rgba(245,244,248,0.55)",
    muted2: "rgba(245,244,248,0.35)",
    rowText: "rgba(245,244,248,0.75)",
    cardBg: "rgba(255,255,255,0.07)",
    cardBorder: "rgba(255,255,255,0.16)",
    cardShadow: "0 16px 40px rgba(0,0,0,0.35)",
    divider: "rgba(255,255,255,0.1)",
    tagBg: "rgba(255,255,255,0.08)",
    tagBorder: "1px solid rgba(255,255,255,0.12)",
    highlightInk: "#22d3ee",
    successBg: "rgba(47,111,92,0.18)",
    successText: "#bfe3d8",
    successBorder: "1px solid rgba(47,111,92,0.5)",
  },
  light: {
    text: "#12151c",
    muted: "rgba(18,21,28,0.6)",
    muted2: "rgba(18,21,28,0.32)",
    rowText: "rgba(18,21,28,0.72)",
    cardBg: "rgba(255,255,255,0.75)",
    cardBorder: "rgba(15,23,42,0.12)",
    cardShadow: "0 16px 40px rgba(15,23,42,0.14)",
    divider: "rgba(15,23,42,0.1)",
    tagBg: "rgba(15,23,42,0.06)",
    tagBorder: "1px solid rgba(15,23,42,0.12)",
    highlightInk: "#0e8a4f",
    successBg: "rgba(47,111,92,0.12)",
    successText: "#1c5f4a",
    successBorder: "1px solid rgba(47,111,92,0.35)",
  },
};

type Palette = (typeof PALETTE)["dark"];

function cardStyle(p: Palette): CSSProperties {
  return {
    borderRadius: 20,
    background: p.cardBg,
    border: `1px solid ${p.cardBorder}`,
    boxShadow: p.cardShadow,
  };
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";
const HERO_W = 640;
const HERO_H = 760;

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Easing / interpolation (exact from animations-v2.jsx) ───────────────────
const Easing = {
  linear: (t: number) => t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutBack: (t: number) => {
    const c1 = 1.70158,
      c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

function interpolate(
  input: number[],
  output: number[],
  ease: ((t: number) => number) | ((t: number) => number)[] = Easing.linear,
) {
  return (t: number) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const easeFn = Array.isArray(ease) ? ease[i] || Easing.linear : ease;
        const eased = easeFn(local);
        return output[i] + (output[i + 1] - output[i]) * eased;
      }
    }
    return output[output.length - 1];
  };
}

// ── Shared scene primitives (exact from source) ──────────────────────────────
type SceneCtx = { localTime: number; dur: number; index: number; count: number; theme: Theme };
const SceneContext = createContext<SceneCtx>({
  localTime: 0,
  dur: 0,
  index: 0,
  count: 0,
  theme: "dark",
});
const useScene = () => useContext(SceneContext);

function SceneFrame({ children }: { children: ReactNode }) {
  return <div style={{ position: "absolute", inset: 0 }}>{children}</div>;
}

function Avatar({
  initial,
  color,
  size = 48,
}: {
  initial: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.4,
        fontFamily: FONT,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

function CheckBadge({
  size = 28,
  bg = TEAL,
  opacity = 1,
  scale = 1,
}: {
  size?: number;
  bg?: string;
  opacity?: number;
  scale?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${scale})`,
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ color: "#fff", fontSize: size * 0.55, fontWeight: 700, lineHeight: 1 }}>
        &#10003;
      </span>
    </div>
  );
}

function Tag({
  children,
  color,
  bg,
  border,
}: {
  children: ReactNode;
  color?: string;
  bg?: string;
  border?: string;
}) {
  const { theme } = useScene();
  const p = PALETTE[theme];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 11px",
        borderRadius: 20,
        background: bg ?? p.tagBg,
        border: border ?? p.tagBorder,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: color ?? p.muted,
        textTransform: "uppercase",
        fontFamily: FONT,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

// ── Scene 1: Open the window ─────────────────────────────────────────────────
function CreateEvent() {
  const { localTime, theme } = useScene();
  const p = PALETTE[theme];
  const entryP = Easing.easeInOutCubic(clamp(localTime / 0.4, 0, 1));
  const hintP = Easing.easeInOutCubic(clamp((localTime - 0.85) / 0.35, 0, 1));
  return (
    <SceneFrame>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 250,
          width: 520,
          transform: `translate(-50%,${(1 - entryP) * 14}px)`,
          opacity: entryP,
          ...cardStyle(p),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 15, padding: "22px 24px" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: PURPLE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                border: "2px solid rgba(255,255,255,0.85)",
                borderRadius: "50%",
                borderTopColor: "transparent",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: p.text, fontFamily: FONT, whiteSpace: "nowrap" }}>
              Zara Puffer Drop · 2h window
            </div>
            <div style={{ fontSize: 13, color: p.muted, fontFamily: FONT, marginTop: 3, whiteSpace: "nowrap" }}>
              Starting a group buy
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: "50%", top: 372, transform: "translateX(-50%)", opacity: hintP }}>
        <Tag>Add friends to invite →</Tag>
      </div>
    </SceneFrame>
  );
}

// ── Scene 2: Invite friends ───────────────────────────────────────────────────
function Invite() {
  const { localTime, theme } = useScene();
  const p = PALETTE[theme];
  const people = [
    { n: "Maya", c: AVATAR_ACCENT, i: "M" },
    { n: "Jordan", c: PURPLE, i: "J" },
    { n: "Sam", c: BLUE, i: "S" },
  ];
  const labelP = Easing.easeInOutCubic(clamp(localTime / 0.3, 0, 1));
  const waitP = Easing.easeInOutCubic(clamp((localTime - 0.7) / 0.3, 0, 1));
  return (
    <SceneFrame>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 88,
          width: 440,
          transform: "translate(-50%,0) scale(0.94)",
          opacity: 0.22,
          ...cardStyle(p),
          padding: "16px 20px",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: p.text, fontFamily: FONT, whiteSpace: "nowrap" }}>
          Zara Puffer Drop · 2h window
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 210,
          transform: "translateX(-50%)",
          opacity: labelP,
          fontSize: 17,
          fontWeight: 600,
          color: p.text,
          fontFamily: FONT,
          whiteSpace: "nowrap",
        }}
      >
        Inviting Maya, Jordan &amp; Sam
      </div>
      <div style={{ position: "absolute", left: "50%", top: 265, transform: "translateX(-50%)", display: "flex", gap: 36 }}>
        {people.map((person, i) => {
          const d = Easing.easeInOutCubic(clamp((localTime - 0.12 * i) / 0.32, 0, 1));
          return (
            <div
              key={person.n}
              style={{
                opacity: d,
                transform: `translateY(${(1 - d) * 12}px)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Avatar initial={person.i} color={person.c} size={50} />
              <div style={{ fontSize: 13, color: p.text, fontFamily: FONT, fontWeight: 600 }}>{person.n}</div>
              <Tag>Invited</Tag>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 415,
          transform: "translateX(-50%)",
          opacity: waitP,
          fontSize: 13,
          color: p.muted,
          fontFamily: FONT,
          whiteSpace: "nowrap",
        }}
      >
        Waiting for responses…
      </div>
    </SceneFrame>
  );
}

// ── Scene 3: Cart adds coming in ─────────────────────────────────────────────
const PEOPLE = [
  { n: "Maya", i: "M", c: AVATAR_ACCENT, cart: "$128", items: "Puffer jacket, beanie" },
  { n: "Jordan", i: "J", c: PURPLE, cart: "$96", items: "Graphic tee, tote bag" },
  { n: "Sam", i: "S", c: BLUE, cart: "$154", items: "Puffer jacket, wool scarf" },
];

function Submissions() {
  const { localTime, dur, theme } = useScene();
  const p = PALETTE[theme];
  const SEG = dur / 3;
  const activeContinuous = clamp(localTime / SEG, 0, 2);
  const mainY = 260;
  return (
    <SceneFrame>
      <div style={{ position: "absolute", left: "50%", top: 70, transform: "translateX(-50%)", display: "flex", gap: 18 }}>
        {PEOPLE.map((person, k) => {
          const responded = localTime > k * SEG + 0.4;
          const started = localTime >= k * SEG;
          return (
            <div key={person.n} style={{ position: "relative", opacity: started ? 1 : 0.18 }}>
              <Avatar initial={person.i} color={person.c} size={30} />
              {responded && (
                <div
                  style={{
                    position: "absolute",
                    right: -3,
                    bottom: -3,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: TEAL,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>&#10003;</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {PEOPLE.map((person, k) => {
        const localSince = localTime - k * SEG;
        if (localSince < 0) return null;
        const entryP = Easing.easeInOutCubic(clamp(localSince / 0.3, 0, 1));
        const depth = clamp(activeContinuous - k, 0, 2);
        const y = interpolate([0, 1, 2], [mainY, mainY - 92, mainY - 156], Easing.easeInOutCubic)(depth);
        const scale = interpolate([0, 1, 2], [1, 0.95, 0.9])(depth);
        const baseOpacity = interpolate([0, 1, 2], [1, 0.32, 0.12])(depth);
        const riseOffset = (1 - entryP) * 16;
        const checkP = Easing.easeOutBack(clamp((localSince - 0.4) / 0.28, 0, 1));
        return (
          <div
            key={person.n}
            style={{
              position: "absolute",
              left: "50%",
              top: y + riseOffset,
              width: 480,
              zIndex: 10 + k,
              transform: `translate(-50%,0) scale(${scale})`,
              opacity: baseOpacity * entryP,
              ...cardStyle(p),
              padding: "18px 22px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Avatar initial={person.i} color={person.c} size={42} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: p.text, fontFamily: FONT }}>
                {person.n} · {person.cart}
              </div>
              <div style={{ fontSize: 12.5, color: p.muted, fontFamily: FONT, marginTop: 3 }}>{person.items}</div>
            </div>
            <div style={{ position: "relative", width: 28, height: 28 }}>
              <CheckBadge size={28} bg={TEAL} opacity={checkP} scale={0.6 + 0.4 * checkP} />
            </div>
          </div>
        );
      })}
    </SceneFrame>
  );
}

// ── Scene 4: Agent recommending ──────────────────────────────────────────────
function Reconciling() {
  const { localTime, dur, theme } = useScene();
  const p = PALETTE[theme];
  const entryP = Easing.easeInOutCubic(clamp(localTime / 0.35, 0, 1));
  const phrases = ["Checking the group's carts…", "Tracking the threshold…", "Building bundle picks…"];
  const seg = dur / 3;
  const idx = Math.min(2, Math.floor(localTime / seg));
  const withinSeg = localTime - idx * seg;
  const fadeIn = Easing.easeInOutCubic(clamp(withinSeg / 0.25, 0, 1));
  const fadeOut = 1 - Easing.easeInCubic(clamp((withinSeg - (seg - 0.25)) / 0.25, 0, 1));
  const phraseOpacity = idx === 2 ? fadeIn : Math.min(fadeIn, fadeOut);
  const dots = [0, 1, 2].map((i) => 0.5 + 0.5 * Math.sin(localTime * 3.2 - i * 0.8));
  return (
    <SceneFrame>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 80,
          width: 420,
          transform: "translate(-50%,0) scale(0.9)",
          opacity: 0.2,
          ...cardStyle(p),
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Avatar initial="S" color={BLUE} size={34} />
        <div style={{ fontSize: 14, fontWeight: 700, color: p.text, fontFamily: FONT }}>Sam · $154</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 280,
          transform: `translate(-50%,${(1 - entryP) * 12}px)`,
          opacity: entryP,
          ...cardStyle(p),
          borderRadius: 36,
          padding: "12px 22px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex" }}>
          <Avatar initial="M" color={AVATAR_ACCENT} size={30} />
          <div style={{ marginLeft: -9 }}>
            <Avatar initial="J" color={PURPLE} size={30} />
          </div>
          <div style={{ marginLeft: -9 }}>
            <Avatar initial="S" color={BLUE} size={30} />
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: p.text, fontFamily: FONT, whiteSpace: "nowrap" }}>
          Agent recommending
        </div>
        <div style={{ display: "flex", gap: 5, marginLeft: 2 }}>
          {dots.map((o, i) => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: p.text, opacity: 0.35 + 0.5 * o }} />
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 372,
          transform: "translateX(-50%)",
          opacity: phraseOpacity,
          fontSize: 13.5,
          color: p.muted,
          fontFamily: FONT,
          whiteSpace: "nowrap",
        }}
      >
        {phrases[idx]}
      </div>
    </SceneFrame>
  );
}

// ── Scene 5 & 6 & 7 shared data ──────────────────────────────────────────────
const OPTIONS = [
  {
    key: "A",
    label: "Cozy Starter",
    total: 460,
    pp: 153,
    rows: ["Puffer jacket · $120", "Beanie · $28", "Wool socks · $22", "Crosses the threshold"],
  },
  {
    key: "B",
    label: "Full Fit",
    total: 540,
    pp: 180,
    rows: ["Puffer jacket · $120", "Wool scarf · $45", "Graphic tee · $38", "+ free shipping unlocked"],
  },
  {
    key: "C",
    label: "Squad Pack",
    total: 410,
    pp: 137,
    rows: ["Puffer jacket · $120", "Tote bag · $32", "Beanie · $28", "Fastest to threshold"],
  },
];

function OptionCard({
  opt,
  index,
  localTime,
  highlighted,
  accent,
}: {
  opt: (typeof OPTIONS)[number];
  index: number;
  localTime: number;
  highlighted: string;
  accent: string;
}) {
  const { theme } = useScene();
  const p = PALETTE[theme];
  const start = index * 0.12;
  const entryP = Easing.easeInOutCubic(clamp((localTime - start) / 0.35, 0, 1));
  const isHi = opt.key === highlighted;
  const hiP = Easing.easeInOutCubic(clamp((localTime - start - 0.28) / 0.32, 0, 1));
  const base = cardStyle(p);
  return (
    <div
      style={{
        opacity: entryP,
        transform: `translateY(${(1 - entryP) * 18}px)`,
        width: 178,
        height: 360,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        padding: "18px 16px",
        ...base,
        border: isHi ? `1.5px solid ${hexToRgba(accent, 0.25 + 0.65 * hiP)}` : base.border,
        boxShadow: isHi
          ? `0 16px 40px rgba(0,0,0,0.35), 0 0 30px ${hexToRgba(accent, 0.22 * hiP)}`
          : base.boxShadow,
      }}
    >
      {isHi && (
        <div style={{ position: "absolute", top: -11, right: 12, opacity: hiP }}>
          <Tag bg={accent} color="#fff" border="none">
            Top pick
          </Tag>
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: p.muted, fontFamily: FONT, textTransform: "uppercase" }}>
        Bundle {opt.key}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: p.text, fontFamily: FONT, marginTop: 5 }}>{opt.label}</div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: p.text, fontFamily: FONT, lineHeight: 1 }}>
          ${opt.total.toLocaleString()}
        </div>
        <div style={{ fontSize: 10.5, color: p.muted, fontFamily: FONT, marginTop: 3 }}>${opt.pp}/person</div>
      </div>
      <div style={{ height: 1, background: p.divider, margin: "13px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {opt.rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, color: p.rowText, fontFamily: FONT }}>
            <div style={{ width: 4, height: 4, borderRadius: 2, background: isHi ? accent : p.muted2, flexShrink: 0 }} />
            {r}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scene 5: Bundles ready ───────────────────────────────────────────────────
function OptionsScene({ highlighted = "B", accent }: { highlighted?: string; accent?: string }) {
  const { localTime, theme } = useScene();
  const p = PALETTE[theme];
  const resolvedAccent = accent ?? p.highlightInk;
  const labelP = Easing.easeInOutCubic(clamp(localTime / 0.3, 0, 1));
  return (
    <SceneFrame>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 70,
          transform: "translate(-50%,0) scale(0.9)",
          opacity: 0.18,
          ...cardStyle(p),
          borderRadius: 36,
          padding: "10px 18px",
          fontSize: 12.5,
          color: p.text,
          fontFamily: FONT,
          whiteSpace: "nowrap",
        }}
      >
        Agent recommending
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 118,
          transform: "translateX(-50%)",
          opacity: labelP,
          fontSize: 16.5,
          fontWeight: 600,
          color: p.text,
          fontFamily: FONT,
          whiteSpace: "nowrap",
        }}
      >
        3 bundles ready
      </div>
      <div style={{ position: "absolute", left: "50%", top: 172, transform: "translateX(-50%)", display: "flex", gap: 14 }}>
        {OPTIONS.map((opt, i) => (
          <OptionCard key={opt.key} opt={opt} index={i} localTime={localTime} highlighted={highlighted} accent={resolvedAccent} />
        ))}
      </div>
    </SceneFrame>
  );
}

// ── Scene 6: Threshold crossed ───────────────────────────────────────────────
function PickScene({ highlighted = "B", accent }: { highlighted?: string; accent?: string }) {
  const { localTime, theme } = useScene();
  const p = PALETTE[theme];
  const resolvedAccent = accent ?? p.highlightInk;
  const dimP = Easing.easeInOutCubic(clamp((localTime - 0.2) / 0.4, 0, 1));
  const checkP = Easing.easeOutBack(clamp((localTime - 0.4) / 0.32, 0, 1));
  const tagP = Easing.easeInOutCubic(clamp((localTime - 0.7) / 0.3, 0, 1));
  const base = cardStyle(p);
  return (
    <SceneFrame>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 118,
          transform: "translateX(-50%)",
          fontSize: 16.5,
          fontWeight: 600,
          color: p.text,
          fontFamily: FONT,
          whiteSpace: "nowrap",
        }}
      >
        3 bundles ready
      </div>
      <div style={{ position: "absolute", left: "50%", top: 172, transform: "translateX(-50%)", display: "flex", gap: 14 }}>
        {OPTIONS.map((opt) => {
          const isHi = opt.key === highlighted;
          const opacity = isHi ? 1 : 1 - dimP * 0.62;
          const scale = isHi ? 1 + 0.01 * checkP : 1 - 0.03 * dimP;
          return (
            <div
              key={opt.key}
              style={{
                position: "relative",
                opacity,
                transform: `scale(${scale})`,
                width: 178,
                height: 360,
                display: "flex",
                flexDirection: "column",
                padding: "18px 16px",
                ...base,
                border: isHi ? `1.5px solid ${resolvedAccent}` : base.border,
              }}
            >
              {isHi && (
                <div style={{ position: "absolute", top: -14, right: -14, opacity: checkP, transform: `scale(${0.6 + 0.4 * checkP})` }}>
                  <CheckBadge size={32} bg={TEAL} />
                </div>
              )}
              {isHi && (
                <div style={{ position: "absolute", top: -11, right: 12 }}>
                  <Tag bg={resolvedAccent} color="#fff" border="none">
                    Top pick
                  </Tag>
                </div>
              )}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: p.muted, fontFamily: FONT, textTransform: "uppercase" }}>
                Bundle {opt.key}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: p.text, fontFamily: FONT, marginTop: 5 }}>{opt.label}</div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 21, fontWeight: 700, color: p.text, fontFamily: FONT, lineHeight: 1 }}>
                  ${opt.total.toLocaleString()}
                </div>
                <div style={{ fontSize: 10.5, color: p.muted, fontFamily: FONT, marginTop: 3 }}>${opt.pp}/person</div>
              </div>
              <div style={{ height: 1, background: p.divider, margin: "13px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {opt.rows.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, color: p.rowText, fontFamily: FONT }}>
                    <div style={{ width: 4, height: 4, borderRadius: 2, background: isHi ? resolvedAccent : p.muted2, flexShrink: 0 }} />
                    {r}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: "50%", top: 552, transform: "translateX(-50%)", opacity: tagP }}>
        <Tag bg={p.successBg} color={p.successText} border={p.successBorder}>
          3/3 checked out · Bundle {highlighted}
        </Tag>
      </div>
    </SceneFrame>
  );
}

// ── Scene 7: Discount unlocked ───────────────────────────────────────────────
function Booked({ highlighted = "B", accent }: { highlighted?: string; accent?: string }) {
  const { localTime, theme } = useScene();
  const p = PALETTE[theme];
  const resolvedAccent = accent ?? p.highlightInk;
  const opt = OPTIONS.find((o) => o.key === highlighted) || OPTIONS[1];
  const entryP = Easing.easeInOutCubic(clamp(localTime / 0.4, 0, 1));
  const scale = 0.95 + 0.05 * entryP;
  return (
    <SceneFrame>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 80,
          width: 340,
          height: 120,
          transform: "translate(-50%,0) scale(0.92)",
          opacity: 0.2,
          ...cardStyle(p),
          padding: "18px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 230,
          width: 480,
          transform: `translate(-50%,0) scale(${scale})`,
          opacity: entryP,
          ...cardStyle(p),
          border: `1.5px solid ${resolvedAccent}`,
          boxShadow: `0 16px 40px rgba(0,0,0,0.35), 0 0 36px ${hexToRgba(resolvedAccent, 0.16)}`,
          padding: "28px 30px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ position: "relative", width: 38, height: 38 }}>
              <CheckBadge size={38} bg={resolvedAccent} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: p.text, fontFamily: FONT }}>Discount unlocked</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Tag bg={p.successBg} color={p.successText} border={p.successBorder}>
            3/3 checked out
          </Tag>
        </div>
        <div style={{ height: 1, background: p.divider, margin: "20px 0 18px" }} />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: p.text, fontFamily: FONT }}>${opt.total.toLocaleString()}</div>
          <div style={{ fontSize: 14, color: p.muted, fontFamily: FONT }}>${opt.pp}/person</div>
        </div>
        <div style={{ fontSize: 13, color: p.muted, fontFamily: FONT, marginTop: 12 }}>Puffer jacket, scarf &amp; tee unlocked at 20% off for everyone</div>
      </div>
    </SceneFrame>
  );
}

// ── Scene sequencing ──────────────────────────────────────────────────────────
// Timing (durations, count, loop math) exact from window.OM_SCENES /
// window.OM_PLAYBACK in demo.html — only the `name` labels moved.
const SCENES: { name: string; dur: number }[] = [
  { name: "Open the window", dur: 4 },
  { name: "Invite friends", dur: 4 },
  { name: "Cart adds coming in", dur: 4 },
  { name: "Agent recommending", dur: 4 },
  { name: "Bundles ready", dur: 4 },
  { name: "Threshold crossed", dur: 4 },
  { name: "Discount unlocked", dur: 4 },
];
const SCENE_COMPONENTS = [CreateEvent, Invite, Submissions, Reconciling, OptionsScene, PickScene, Booked];
const TOTAL_DUR = SCENES.reduce((sum, s) => sum + s.dur, 0);

const SCENE_STARTS: number[] = [0];
for (const s of SCENES) SCENE_STARTS.push(SCENE_STARTS[SCENE_STARTS.length - 1] + s.dur);

function activeScene(time: number) {
  let index = SCENES.length - 1;
  for (let i = 0; i < SCENES.length; i++) {
    if (time < SCENE_STARTS[i + 1]) {
      index = i;
      break;
    }
  }
  const localTime = clamp(time - SCENE_STARTS[index], 0, SCENES[index].dur);
  return { index, localTime };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** requestAnimationFrame clock, wrapping forever — same timing math as the
 * source engine's Stage component (delta-time accumulation, modulo wrap). */
function useLoopClock(total: number, paused: boolean) {
  const [time, setTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return;
    const step = (ts: number) => {
      if (lastRef.current == null) lastRef.current = ts;
      const dt = (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      setTime((t) => {
        const next = t + dt;
        return next >= total ? next % total : next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
    };
  }, [total, paused]);

  return time;
}

/** Measures the wrapper's rendered width and scales the fixed 640×760
 * composition to fit it, preserving every pixel value inside unchanged. */
function useContainerScale(nativeWidth: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / nativeWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [nativeWidth]);
  return [ref, scale] as const;
}

export function GroupPlanningAnimation({ className }: { className?: string }) {
  const { theme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const time = useLoopClock(TOTAL_DUR, reducedMotion);
  // Reduced motion: hold on the settled last frame (Discount unlocked, fully
  // entered) instead of running the loop — a meaningful static state.
  const { index, localTime } = activeScene(reducedMotion ? TOTAL_DUR - 0.001 : time);
  const [containerRef, scale] = useContainerScale(HERO_W);

  const Scene = SCENE_COMPONENTS[index];
  const ctx: SceneCtx = { localTime, dur: SCENES[index].dur, index, count: SCENES.length, theme };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${HERO_W} / ${HERO_H}`,
        overflow: "hidden",
        background: "transparent",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: HERO_W,
          height: HERO_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: "transparent",
        }}
      >
        <SceneContext.Provider value={ctx}>
          <Scene key={index} />
        </SceneContext.Provider>
      </div>
    </div>
  );
}
