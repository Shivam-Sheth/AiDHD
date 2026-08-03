import { CONTACT_EMAIL } from "./footer-links";

/** A paragraph, or a bulleted list of points. */
export type LegalBlock = string | { list: string[] };

export type LegalSection = {
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

/**
 * Renders a legal document from data: numbered sections, anchor ids, and a
 * jump list. Keeping the three policies as data (rather than three hand-laid
 * pages) is what keeps their headings, spacing, and anchors identical.
 */
export function LegalDoc({
  updated,
  intro,
  sections,
}: {
  updated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">Last updated:</span>{" "}
          {updated}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Pact is a prototype built for the Prava Agentic Commerce Hackathon.
          This document describes how the prototype actually behaves and is not
          legal advice — have counsel review it before running the product
          commercially.
        </p>
      </div>

      {intro ? (
        <p className="mt-8 leading-relaxed text-[var(--muted)]">{intro}</p>
      ) : null}

      <nav className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-xs font-semibold tracking-wider text-[var(--faint)] uppercase">
          On this page
        </p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--coral)]"
              >
                {i + 1}. {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 space-y-10">
        {sections.map((section, i) => (
          <section key={section.id} id={section.id} className="scroll-mt-28">
            <h2 className="font-display text-xl font-semibold text-[var(--ink)]">
              {i + 1}. {section.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {section.blocks.map((block, bi) =>
                typeof block === "string" ? (
                  <p key={bi} className="leading-relaxed text-[var(--muted)]">
                    {block}
                  </p>
                ) : (
                  <ul key={bi} className="space-y-2 pl-1">
                    {block.list.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 leading-relaxed text-[var(--muted)]"
                      >
                        <span
                          aria-hidden
                          className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--coral)]"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-sm text-[var(--muted)]">
          Questions about this policy?{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[var(--coral)] underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
