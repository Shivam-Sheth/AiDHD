import { NextResponse } from "next/server";
import { hasElevenLabs } from "@/lib/integrations/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signed URL / conversation token for ElevenLabs Conversational AI (browser).
 */
export async function GET() {
  if (!hasElevenLabs()) {
    return NextResponse.json(
      {
        error:
          "ELEVENLABS_API_KEY missing — add it to use live voice. Text agent still works.",
        voice: false,
      },
      { status: 503 },
    );
  }

  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    return NextResponse.json(
      { error: "ELEVENLABS_AGENT_ID not set", voice: false },
      { status: 503 },
    );
  }

  try {
    // Prefer conversation token (works with private agents)
    const tokenRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (tokenRes.ok) {
      const data = (await tokenRes.json()) as { signed_url?: string };
      if (data.signed_url) {
        return NextResponse.json({
          voice: true,
          agent_id: agentId,
          signed_url: data.signed_url,
        });
      }
    }

    // Public agents can connect with agent_id alone
    return NextResponse.json({
      voice: true,
      agent_id: agentId,
      signed_url: null,
      note: "Using agent_id connect (ensure agent is public or signed URL works)",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Signed URL failed",
        voice: false,
        agent_id: agentId,
      },
      { status: 500 },
    );
  }
}
