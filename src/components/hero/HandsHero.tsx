import { ArrowUpRight } from "lucide-react";
import { getHeroHandAssets } from "@/lib/hero-assets";
import { HandsScene } from "./HandsScene";
import { HandsProximity } from "./HandsProximity";

export function HandsHero() {
  const assets = getHeroHandAssets();

  return (
    <section id="top" className="relative flex min-h-svh flex-col bg-canvas">
      {/* Scene band. The headline lives underneath it rather than on top, so the
          hands never fight the type the way an overlaid hero would. */}
      <HandsProximity className="relative min-h-[52svh] flex-1">
        <div className="absolute inset-0">
          <HandsScene assets={assets} />
        </div>

        {/* Pinned to the fingertip contact — see CONTACT in HandsScene. */}
        <a
          href="/login"
          className="focus-ring group absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-strong bg-surface/70 px-6 py-3 text-sm font-semibold text-ink shadow-lifted backdrop-blur-md transition-colors hover:border-ink hover:bg-surface"
        >
          <span className="flex items-center gap-2">
            Join us
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </a>
      </HandsProximity>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-14 lg:px-10 lg:pb-20">
        <h1 className="font-hero animate-slide-up max-w-5xl text-[clamp(2.5rem,6.6vw,5.75rem)] text-ink">
          From group chat chaos to booked in minutes.
        </h1>
        <div className="mt-8 flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-start sm:justify-between">
          <p
            className="animate-slide-up max-w-md text-base leading-relaxed text-muted"
            style={{ animationDelay: "0.12s" }}
          >
            Everyone drops a budget and a vibe. AiDHD reconciles the mess into a few costed plans
            and books them — separate spend limits per category, not one scary lump sum.
          </p>
          <p className="micro shrink-0 text-faint">Concierge for group nights &amp; trips</p>
        </div>
      </div>
    </section>
  );
}
