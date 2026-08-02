import { getModelSrc } from "@/lib/model-assets";
import { PlaneScene } from "@/components/three/PlaneScene";

export default function ModelTestPage() {
  const src = getModelSrc("plane");

  return (
    <main className="min-h-svh bg-canvas p-10">
      <h1 className="font-display text-2xl text-ink">Airliner render check</h1>
      <p className="mt-2 text-sm text-muted">
        {src
          ? `Rendering GLB: ${src}`
          : "No GLB in public/models — rendering the primitive-built airliner."}
      </p>
      <PlaneScene src={src} className="mt-6 h-140 w-full rounded-xl border border-line" />
    </main>
  );
}
