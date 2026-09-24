import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isFiniteCoordinate(value: string | null, min: number, max: number) {
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max ? numeric : null;
}

function compactLocationLabel(address?: Record<string, string>) {
  if (!address) return "";
  const city = address.city ?? address.town ?? address.village ?? address.suburb ?? address.municipality ?? address.county;
  const state = address.state ?? address.region;
  const country = address.country;
  return [city, state, country].filter(Boolean).join(", ");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = isFiniteCoordinate(url.searchParams.get("lat"), -90, 90);
  const longitude = isFiniteCoordinate(url.searchParams.get("lon"), -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/reverse");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("lat", String(latitude));
  endpoint.searchParams.set("lon", String(longitude));
  endpoint.searchParams.set("zoom", "13");
  endpoint.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "DecideEats hackathon demo",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
    }
    const payload = (await response.json()) as { display_name?: string; address?: Record<string, string> };
    const compact = compactLocationLabel(payload.address);
    return NextResponse.json({ label: compact || payload.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
  } catch {
    return NextResponse.json({ label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
  }
}
