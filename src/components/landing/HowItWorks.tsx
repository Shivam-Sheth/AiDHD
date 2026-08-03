const STEPS = [
  {
    n: "1",
    t: "A brand opens a live window",
    d: "Zara — or any Shopify brand — opens a 2-hour group-buy window with a discount and a spend threshold attached.",
  },
  {
    n: "2",
    t: "A friend starts the group",
    d: "One person joins the window and invites their friends. Everyone lands in the same live session.",
  },
  {
    n: "3",
    t: "The agent recommends bundles",
    d: "Everyone picks what they want. The agent nudges each person toward items that fit their budget and suggests bundles that close the group's gap to the threshold.",
  },
  {
    n: "4",
    t: "Checkout unlocks the discount",
    d: "Everyone checks out through prava before the timer hits zero. Cross the threshold together and the discount applies to the whole group.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[var(--surface)] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <h2 className="font-display text-center text-3xl font-bold text-[var(--ink)] sm:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--muted)]">
          Four steps from a group chat to a group discount.
        </p>
        <div className="relative mt-16">
          <div
            className="absolute top-8 right-0 left-0 hidden h-0.5 bg-[var(--line)] lg:block"
            style={{ marginLeft: "12.5%", marginRight: "12.5%", width: "75%" }}
          />
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--coral)] font-display text-2xl font-bold text-white shadow-lg shadow-[var(--coral-shadow)]">
                  {s.n}
                </div>
                <h3 className="font-display mt-6 text-xl font-semibold text-[var(--ink)]">
                  {s.t}
                </h3>
                <p className="mt-2 max-w-xs text-[var(--muted)]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
