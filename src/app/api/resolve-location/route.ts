import { NextResponse } from "next/server";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ResolvedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  provider: "google" | "nominatim";
};

function asCoordinate(value: unknown, min: number, max: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max ? numberValue : null;
}

async function resolveWithGoogle(query: string): Promise<ResolvedLocation | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  endpoint.searchParams.set("address", query);
  endpoint.searchParams.set("key", apiKey);

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };
    const first = payload.status === "OK" ? payload.results?.[0] : null;
    const latitude = asCoordinate(first?.geometry?.location?.lat, -90, 90);
    const longitude = asCoordinate(first?.geometry?.location?.lng, -180, 180);
    if (!first || latitude === null || longitude === null) return null;
    return {
      label: first.formatted_address ?? query,
      latitude,
      longitude,
      provider: "google",
    };
  } catch {
    return null;
  }
}

async function resolveWithNominatim(query: string): Promise<ResolvedLocation | null> {
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("q", query);

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "DecideEats hackathon demo" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = payload[0];
    const latitude = asCoordinate(first?.lat, -90, 90);
    const longitude = asCoordinate(first?.lon, -180, 180);
    if (!first || latitude === null || longitude === null) return null;
    return {
      label: first.display_name ?? query,
      latitude,
      longitude,
      provider: "nominatim",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const limit = rateLimit(requestKey(request, "resolve-location"), 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many location checks. Please try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = typeof (body as { query?: unknown })?.query === "string" ? (body as { query: string }).query.trim().slice(0, 120) : "";
  if (query.length < 2) return NextResponse.json({ error: "Location is too short." }, { status: 400 });

  const searchQuery = /malaysia|singapore|china|japan|korea|usa|america|uk|australia|canada|中国|日本|韩国|新加坡|马来西亚|馬來西亞/i.test(query)
    ? query
    : `${query} city`;

  const resolved = (await resolveWithGoogle(searchQuery)) ?? (await resolveWithNominatim(searchQuery));
  if (!resolved) return NextResponse.json({ error: "Could not resolve that location." }, { status: 404 });

  return NextResponse.json(resolved, { headers: { "Cache-Control": "no-store" } });
}
