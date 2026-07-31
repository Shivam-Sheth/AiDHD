import { DemoApp } from "@/components/DemoApp";

export default function Home() {
  return <DemoApp googleMapsApiKey={process.env.GOOGLE_MAPS_API || null} />;
}
