import { IntegrationStatusPills } from "./IntegrationStatusPills";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div>
          <p className="font-display text-sm text-ink">AiDHD</p>
          <p className="mt-1 text-sm text-muted">
            Built for Prava&apos;s Agentic Commerce Hackathon
          </p>
        </div>
        <IntegrationStatusPills />
      </div>

      {/* CC BY-SA 3.0 on the robot hand requires this credit to stay visible
          wherever the image ships. Full detail in public/ATTRIBUTION.md. */}
      <div className="mx-auto mt-8 max-w-6xl border-t border-line px-6 pt-6 lg:px-10">
        <p className="text-xs leading-relaxed text-faint">
          Hero imagery: robot hand by{" "}
          <a
            href="https://commons.wikimedia.org/wiki/File:Shadow_Hand_Bulb_large_Alpha.png"
            className="focus-ring underline underline-offset-2 hover:text-muted"
            target="_blank"
            rel="noreferrer"
          >
            Shadow Robot Company
          </a>{" "}
          (
          <a
            href="https://creativecommons.org/licenses/by-sa/3.0/"
            className="focus-ring underline underline-offset-2 hover:text-muted"
            target="_blank"
            rel="noreferrer"
          >
            CC BY-SA 3.0
          </a>
          , modified). Human hand: detail from Michelangelo&apos;s{" "}
          <em>The Creation of Adam</em>, public domain.
        </p>
      </div>
    </footer>
  );
}
