import { HeroBackdrop } from "./HeroBackdrop";
import { HeroSilhouette } from "./HeroSilhouette";
import { HeroCanvasLoader } from "./HeroCanvasLoader";

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[92vh] items-center overflow-hidden bg-dusk-950 text-dusk-ink"
    >
      <HeroBackdrop />
      <div className="absolute inset-0 z-10">
        <HeroCanvasLoader />
      </div>
      <HeroSilhouette />

      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-[25] h-[60%] bg-gradient-to-b from-dusk-950/70 via-dusk-950/25 to-transparent"
      />

      <div className="relative z-30 mx-auto w-full max-w-4xl px-6 pt-24 pb-40 text-center lg:px-10">
        <p className="animate-fade-in text-xs font-semibold tracking-[0.3em] text-gold uppercase">
          AiDHD — concierge for group nights &amp; trips
        </p>
        <h1 className="font-display animate-slide-up mt-5 text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
          From group chat chaos
          <br />
          <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-coral via-gold to-coral">
            to booked
          </span>{" "}
          in minutes.
        </h1>
        <p
          className="animate-slide-up mx-auto mt-6 max-w-xl text-lg leading-relaxed text-dusk-muted"
          style={{ animationDelay: "0.1s" }}
        >
          Everyone drops a budget and a vibe — concert night or a whole weekend away. AiDHD
          reconciles the mess into 2–3 real, costed plans, then books them with separate spend
          limits per category. Not one scary lump sum.
        </p>
        <div
          className="animate-slide-up mt-10 flex flex-wrap items-center justify-center gap-4"
          style={{ animationDelay: "0.2s" }}
        >
          <a
            href="#demo"
            className="rounded-full bg-gradient-to-r from-coral to-gold px-7 py-3.5 font-semibold text-dusk-950 shadow-warm transition hover:brightness-105"
          >
            Start planning
          </a>
          <a
            href="#how-it-works"
            className="rounded-full border border-white/25 px-7 py-3.5 font-semibold text-dusk-ink backdrop-blur-sm transition hover:border-white/50 hover:bg-white/5"
          >
            See how it works
          </a>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 z-30 h-24 w-full bg-gradient-to-t from-dusk-950 to-transparent" />
    </section>
  );
}
