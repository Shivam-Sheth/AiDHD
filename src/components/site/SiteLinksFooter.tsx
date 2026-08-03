import Link from "next/link";
import { FOOTER_COLUMNS } from "./footer-links";

/**
 * Slim footer for standalone pages (support/status/faq/gallery/legal). Same
 * columns as the landing page's FooterCTA, minus the CTA block — the pages
 * that use it are destinations, not places to re-pitch the product.
 */
export function SiteLinksFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface)] py-14">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <Link
              href="/"
              className="font-display text-lg font-bold text-[var(--ink)] transition-colors hover:text-[var(--coral)]"
            >
              Pact
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              One chat, one plan, one checkout. Group buys, nights out, and
              trips booked end to end.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-xs font-semibold tracking-wider text-[var(--faint)] uppercase">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--coral)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-[var(--line)] pt-6">
          <p className="text-xs font-medium tracking-wider text-[var(--faint)] uppercase">
            Built for Prava&apos;s Agentic Commerce Hackathon.
          </p>
        </div>
      </div>
    </footer>
  );
}
