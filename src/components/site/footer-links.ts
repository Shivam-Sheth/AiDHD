/**
 * Single source of truth for the footer link columns. Both the landing
 * page's big footer CTA (`landing/FooterCTA.tsx`) and the slim footer on
 * every standalone page (`site/SiteLinksFooter.tsx`) render from this, so a
 * new page only has to be listed once.
 */

export const CONTACT_EMAIL = "ameyagarwal10@gmail.com";

export type FooterLink = {
  label: string;
  href: string;
  /** Landing-page section id — on the landing page itself the link
   *  smooth-scrolls instead of navigating. Elsewhere `href` is used as-is. */
  scrollTo?: string;
};

export const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works", scrollTo: "how-it-works" },
      { label: "Recent drops / Group gallery", href: "/gallery" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Support / Help", href: "/support" },
      { label: "Status page", href: "/status" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact / Email", href: `mailto:${CONTACT_EMAIL}` },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Returns / Refund policy", href: "/legal/refunds" },
      { label: "Privacy Policy", href: "/legal/privacy" },
    ],
  },
];
