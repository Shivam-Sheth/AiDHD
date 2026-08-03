import type { MouseEvent } from "react";
import Link from "next/link";
import { FOOTER_COLUMNS } from "@/components/site/footer-links";

type RenderedLink = {
  label: string;
  href: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: RenderedLink[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-[var(--hero-ink-faint)] uppercase">
        {title}
      </p>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              onClick={link.onClick}
              className="text-sm text-[var(--hero-ink-muted)] transition-colors hover:text-[var(--hero-accent-ink)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FooterCTA({
  busy,
  onStartPlanning,
  onScrollTo,
  integrations,
  healthLoaded,
  healthError,
}: {
  busy: boolean;
  onStartPlanning: () => void;
  onScrollTo?: (id: string) => void;
  integrations: Record<string, string>;
  healthLoaded: boolean;
  healthError: string | null;
}) {
  const entries = Object.entries(integrations);

  return (
    <section className="bg-hero-gradient relative overflow-hidden py-20 lg:py-24">
      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex flex-col gap-14 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md text-left">
            <h2 className="font-display text-3xl font-bold text-[var(--hero-ink)] sm:text-4xl">
              Your favorite brand still does discount codes.
              <br />
              Bring them a group buy instead.
            </h2>
            <div className="mt-8">
              <button
                type="button"
                disabled={busy}
                onClick={onStartPlanning}
                className="rounded-xl bg-[var(--coral)] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[var(--coral-shadow)] transition hover:bg-[var(--coral-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Opening the window…" : "Start a group buy →"}
              </button>
            </div>
          </div>

          {/* Columns come from site/footer-links.ts so this footer and the
              slim one on the standalone pages can never drift apart. Links
              tagged with a section id scroll in place here (this component
              only renders on the landing page) instead of navigating. */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((col) => (
              <FooterColumn
                key={col.title}
                title={col.title}
                links={col.links.map((link) => ({
                  label: link.label,
                  href: link.href,
                  onClick:
                    link.scrollTo && onScrollTo
                      ? (e) => {
                          e.preventDefault();
                          onScrollTo(link.scrollTo as string);
                        }
                      : undefined,
                }))}
              />
            ))}
          </div>
        </div>

        <div className="mt-14 border-t border-[var(--hero-divider)] pt-8">
          <p className="text-xs font-medium tracking-wider text-[var(--hero-ink-faint)] uppercase">
            Built for Prava&apos;s Agentic Commerce Hackathon.{" "}
          </p>
        </div>
      </div>
    </section>
  );
}
