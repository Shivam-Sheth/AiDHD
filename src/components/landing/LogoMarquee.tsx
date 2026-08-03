import { useTheme } from "@/components/ThemeProvider";

/**
 * Real hackathon integration logos, dropped in public/. Duffel and Prava
 * ship as dark navy/black wordmarks; Linq and ElevenLabs ship as white ones.
 * `darkAsset` records which is which (a fixed fact about the file, not a
 * style choice) — against the hero's dark theme the dark-asset logos need
 * invert() to read as white, and against light theme it's the reverse (the
 * white-asset logos need invert() to read as dark). Senso is a colored icon
 * + dark text, so it gets a small light chip instead of ever being inverted
 * (inverting would mangle its actual brand colors, and the chip gives it
 * contrast against either theme on its own).
 */
const PARTNERS: {
  name: string;
  src: string;
  darkAsset?: boolean;
  chip?: boolean;
}[] = [
  { name: "Prava", src: "/prava-payments-logo.svg", darkAsset: true },
  { name: "ElevenLabs", src: "/eleven-labs.svg" },
  { name: "Shopify", src: "/shopify-logo.svg" },
  { name: "Linq", src: "/linq-logo.png" },
  { name: "Duffel", src: "/duffel-logo.png", darkAsset: true },
];

function PartnerLogo({
  name,
  src,
  darkAsset,
  chip,
}: {
  name: string;
  src: string;
  darkAsset?: boolean;
  chip?: boolean;
}) {
  const { theme } = useTheme();
  const invert = !chip && (theme === "dark" ? darkAsset : !darkAsset);

  // eslint-disable-next-line @next/next/no-img-element
  const img = (
    <img
      src={src}
      alt={name}
      className={`h-4 w-auto object-contain sm:h-5 ${invert ? "invert" : ""}`}
    />
  );

  return (
    <div
      className={`mr-12 flex shrink-0 items-center opacity-70 transition duration-300 hover:opacity-100 ${
        chip ? "rounded-lg bg-white/90 px-3 py-2" : ""
      }`}
    >
      {img}
    </div>
  );
}

/**
 * Right-to-left infinite logo marquee.
 *
 * The list is repeated COPIES times (not just duplicated once) and the
 * animation slides by exactly one copy-width (-100/COPIES %, kept in sync
 * with the `marquee` keyframes in globals.css). One copy of 5 logos is only
 * ~875px wide — narrower than most viewports — so duplicating it just once
 * left the tail of the visible window running past the end of the real DOM
 * content partway through the scroll, showing as a blank stretch until the
 * loop wrapped. COPIES=8 keeps the strip long enough (~7000px) to stay ahead
 * of the viewport at every scroll position on any realistic screen width.
 *
 * Spacing comes from each item's own `mr-12`, not a flex `gap`: a shared
 * `gap` only inserts space *between* the duplicated copies once total, so
 * translating by exactly one copy-width would fall short by half a gap and
 * the loop would snap backward every cycle. Per-item margin travels with
 * every item (including the last one of each copy), so the width scales
 * exactly linearly with COPIES and the translation lines up perfectly.
 */
const COPIES = 8;

export function LogoMarquee() {
  const track = Array.from({ length: COPIES }, () => PARTNERS).flat();

  return (
    <div className="relative w-2/3 mx-auto overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="animate-marquee flex w-max items-center py-1">
        {track.map((p, i) => (
          <PartnerLogo key={`${p.name}-${i}`} {...p} />
        ))}
      </div>
    </div>
  );
}
