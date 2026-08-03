import type { MouseEvent } from "react";

type FooterLink = {
  label: string;
  href: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: FooterLink[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wider text-[var(--hero-ink-faint)] uppercase">
        {title}
      </p>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              onClick={link.onClick}
              className="text-sm text-[var(--hero-ink-muted)] transition-colors hover:text-[var(--hero-accent-ink)]"
            >
              {link.label}
            </a>
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

          <div className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3">
            <FooterColumn
              title="Product"
              links={[
                {
                  label: "How it works",
                  href: "#how-it-works",
                  onClick: (e) => {
                    if (!onScrollTo) return;
                    e.preventDefault();
                    onScrollTo("how-it-works");
                  },
                },
                { label: "Recent drops / Group gallery", href: "#" },
              ]}
            />
            <FooterColumn
              title="Support"
              links={[
                { label: "Support / Help", href: "#" },
                { label: "Status page", href: "#" },
                { label: "FAQ", href: "#" },
                { label: "Contact / Email", href: "mailto:hello@aidhd.app" },
              ]}
            />
            <FooterColumn
              title="Legal"
              links={[
                { label: "Terms of Service", href: "#" },
                { label: "Returns / Refund policy", href: "#" },
                { label: "Privacy Policy", href: "#" },
              ]}
            />
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
