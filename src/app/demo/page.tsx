import { DemoApp } from "@/components/DemoApp";

export default function DemoPage() {
  return <DemoApp googleMapsApiKey={process.env.GOOGLE_MAPS_API || null} />;
}
