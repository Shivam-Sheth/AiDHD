import { SiteNav } from "./nav/SiteNav";
import { HandsHero } from "./hero/HandsHero";
import { IntroSection } from "./sections/IntroSection";
import { ProblemSection } from "./sections/ProblemSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { TwoModesSection } from "./sections/TwoModesSection";
import { PlanDemoSection } from "./sections/PlanDemoSection";
import { TestimonialsSection } from "./sections/TestimonialsSection";
import { FinalCtaSection } from "./sections/FinalCtaSection";
import { SiteFooter } from "./footer/SiteFooter";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteNav />
      <HandsHero />
      <IntroSection />
      <ProblemSection />
      <HowItWorksSection />
      <TwoModesSection />
      <PlanDemoSection />
      <TestimonialsSection />
      <FinalCtaSection />
      <SiteFooter />
    </div>
  );
}
