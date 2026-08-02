const STEPS = [
  {
    n: "1",
    t: "Start an event, invite the group",
    d: "A multi-day trip or a Friday night out — pick the type, add who's coming.",
  },
  {
    n: "2",
    t: "Everyone drops a budget + vibe",
    d: "Each invitee fills in their own spend cap and preferences independently, on web, WhatsApp, or iMessage.",
  },
  {
    n: "3",
    t: "The agent builds 2–3 costed options",
    d: "Trips get flights + hotel + a day-by-day itinerary + dinner. Outings get ticket tiers, timing, and add-ons — all inside the group's combined budget.",
  },
  {
    n: "4",
    t: "The group picks. It gets booked.",
    d: "One vote wins. Separate Prava payment limits per category, then the agent books it end-to-end.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-center text-3xl font-bold text-neutral-900 sm:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-neutral-600">
          Four steps from a scattered group chat to a booked plan.
        </p>
        <div className="relative mt-16">
          <div
            className="absolute top-8 right-0 left-0 hidden h-0.5 bg-neutral-200 lg:block"
            style={{ marginLeft: "12.5%", marginRight: "12.5%", width: "75%" }}
          />
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--coral)] font-display text-2xl font-bold text-white shadow-lg shadow-[var(--coral-shadow)]">
                  {s.n}
                </div>
                <h3 className="font-display mt-6 text-xl font-semibold text-neutral-900">
                  {s.t}
                </h3>
                <p className="mt-2 max-w-xs text-neutral-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
