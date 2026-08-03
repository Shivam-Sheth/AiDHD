import type { Metadata } from "next";
import { ReelPlanner } from "@/components/ReelPlanner";

export const metadata: Metadata = {
  title: "Pact — Reel to itinerary",
  description:
    "Paste an Instagram or TikTok reel link (plus caption/transcript) and get a day plan.",
};

export default function ReelPage() {
  return <ReelPlanner />;
}
