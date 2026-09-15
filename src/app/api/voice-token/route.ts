import { NextResponse } from "next/server";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = rateLimit(requestKey(request, "voice-token"), 12, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many voice sessions. Please try again in a minute." }, { status: 429 });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ASSEMBLYAI_API_KEY is not configured on the server." }, { status: 503 });
  }
  const endpoint = new URL("https://agents.assemblyai.com/v1/token");
  endpoint.searchParams.set("expires_in_seconds", "120");
  endpoint.searchParams.set("max_session_duration_seconds", "900");
  try {
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
    if (!response.ok) {
      console.error("AssemblyAI token request failed", response.status);
      return NextResponse.json({ error: "Unable to create a temporary voice token." }, { status: 502 });
    }
    const payload = (await response.json()) as { token?: string };
    if (!payload.token) return NextResponse.json({ error: "Voice provider returned no token." }, { status: 502 });
    return NextResponse.json({ token: payload.token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Voice provider is unavailable. Please try again." }, { status: 503 });
  }
}
