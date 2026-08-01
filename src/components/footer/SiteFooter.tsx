import { IntegrationStatusPills } from "./IntegrationStatusPills";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-dusk-950 py-10 text-dusk-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div>
          <p className="font-display font-bold">AiDHD</p>
          <p className="mt-1 text-sm text-dusk-muted">Built for Prava&apos;s Agentic Commerce Hackathon</p>
        </div>
        <IntegrationStatusPills />
      </div>
    </footer>
  );
}
