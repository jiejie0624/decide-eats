import { NextResponse } from "next/server";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ResolvedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  provider: "nominatim" | "photon";
  country?: string;
  countryCode?: string;
};

type LocationCandidate = ResolvedLocation & {
  score: number;
};

const speechRepairs: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /哭来|古来|kulaii|coolai|ku lai/i, replacement: "Kulai, Johor, Malaysia" },
  { pattern: /美里|mily|meeree|miri/i, replacement: "Miri, Sarawak, Malaysia" },
  { pattern: /亚庇|亞庇|kk\b|kinabalu/i, replacement: "Kota Kinabalu, Sabah, Malaysia" },
  { pattern: /新山|jb\b|johor baru/i, replacement: "Johor Bahru, Johor, Malaysia" },
  { pattern: /吉隆坡|kay el\b|kl\b/i, replacement: "Kuala Lumpur, Malaysia" },
];

function asCoordinate(value: unknown, min: number, max: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max ? numberValue : null;
}

function normalizeQuery(query: string) {
  return query
    .replace(/\b(?:i live in|i am in|i'm in|im in|i stay in|i am from|i'm from|im from|near|around|area is|location is|search in)\b/gi, "")
    .replace(/\b(?:restaurant|restaurants|food|place|places|near me|delivery)\b/gi, "")
    .replace(/(?:我在|我住在|我来自|我來自|地点是|地點是|位置是|地区是|地區是|附近在)/g, "")
    .replace(/[，。！？,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMalaysiaContext(countryCode?: string, contextLabel?: string) {
  return countryCode?.toUpperCase() === "MY" || /malaysia|马来西亚|馬來西亞|johor|sarawak|sabah|perak|kuala lumpur/i.test(contextLabel ?? "");
}

function repairedQueries(query: string, preferMalaysia: boolean) {
  const normalized = normalizeQuery(query);
  const variants = new Set<string>();
  variants.add(normalized);
  for (const repair of speechRepairs) {
    if (repair.pattern.test(normalized)) variants.add(repair.replacement);
  }
  if (preferMalaysia && !/malaysia|马来西亚|馬來西亞/i.test(normalized)) {
    variants.add(`${normalized}, Malaysia`);
  }
  if (!/\b(city|town|state|country|malaysia|singapore|china|japan|korea|usa|america|uk|australia|canada)\b|中国|日本|韩国|新加坡|马来西亚|馬來西亞/i.test(normalized)) {
    variants.add(`${normalized} city`);
    variants.add(`${normalized} location`);
  }
  return Array.from(variants).filter((item) => item.length >= 2).slice(0, 5);
}

function scoreLabel(label: string, query: string, providerBoost = 0, preferredCountryCode?: string) {
  const lowerLabel = label.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let score = providerBoost;
  if (lowerLabel.includes(lowerQuery)) score += 8;
  if (/\b(city|town|village|municipality|district|state|province|country)\b/i.test(label)) score += 2;
  if (preferredCountryCode === "MY" && /malaysia/i.test(label)) score += 12;
  if (preferredCountryCode === "MY" && /united kingdom|england|london/i.test(label)) score -= 20;
  if (/\brestaurant|hotel|shop|mall|road|street\b/i.test(label)) score -= 3;
  return score;
}

async function resolveWithNominatim(query: string, preferredCountryCode?: string): Promise<LocationCandidate[]> {
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("limit", "5");
  endpoint.searchParams.set("q", query);
  if (preferredCountryCode) endpoint.searchParams.set("countrycodes", preferredCountryCode.toLowerCase());

  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "DecideEats hackathon demo" },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      importance?: number;
      type?: string;
      class?: string;
      address?: { country?: string; country_code?: string };
    }>;
    return payload.flatMap((item) => {
      const latitude = asCoordinate(item.lat, -90, 90);
      const longitude = asCoordinate(item.lon, -180, 180);
      if (latitude === null || longitude === null || !item.display_name) return [];
      const typeBoost = /city|town|village|municipality|administrative|state|province|country/i.test(`${item.class ?? ""} ${item.type ?? ""}`) ? 5 : 0;
      return [{
        label: item.display_name,
        latitude,
        longitude,
        provider: "nominatim" as const,
        country: item.address?.country,
        countryCode: item.address?.country_code?.toUpperCase(),
        score: scoreLabel(item.display_name, query, typeBoost + Math.round((item.importance ?? 0) * 10), preferredCountryCode),
      }];
    });
  } catch {
    return [];
  }
}

async function resolveWithPhoton(query: string, preferredCountryCode?: string): Promise<LocationCandidate[]> {
  const endpoint = new URL("https://photon.komoot.io/api/");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("limit", "5");

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          name?: string;
          city?: string;
          state?: string;
          country?: string;
          countrycode?: string;
          osm_value?: string;
        };
      }>;
    };
    return (payload.features ?? []).flatMap((feature) => {
      const [longitudeRaw, latitudeRaw] = feature.geometry?.coordinates ?? [];
      const latitude = asCoordinate(latitudeRaw, -90, 90);
      const longitude = asCoordinate(longitudeRaw, -180, 180);
      const label = [feature.properties?.name, feature.properties?.city, feature.properties?.state, feature.properties?.country]
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(", ");
      if (latitude === null || longitude === null || !label) return [];
      const typeBoost = /city|town|village|municipality|state|country/i.test(feature.properties?.osm_value ?? "") ? 4 : 0;
      return [{
        label,
        latitude,
        longitude,
        provider: "photon" as const,
        country: feature.properties?.country,
        countryCode: feature.properties?.countrycode?.toUpperCase(),
        score: scoreLabel(label, query, typeBoost, preferredCountryCode),
      }];
    });
  } catch {
    return [];
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

  const rawQuery = typeof (body as { query?: unknown })?.query === "string" ? (body as { query: string }).query.trim().slice(0, 120) : "";
  const contextLabel = typeof (body as { contextLabel?: unknown })?.contextLabel === "string" ? (body as { contextLabel: string }).contextLabel.trim().slice(0, 160) : "";
  const countryCode = typeof (body as { countryCode?: unknown })?.countryCode === "string" ? (body as { countryCode: string }).countryCode.trim().slice(0, 2).toUpperCase() : "";
  if (rawQuery.length < 2) return NextResponse.json({ error: "Location is too short." }, { status: 400 });

  const preferMalaysia = isMalaysiaContext(countryCode, contextLabel);
  const preferredCountryCode = preferMalaysia ? "MY" : countryCode || undefined;
  const candidates: LocationCandidate[] = [];
  for (const query of repairedQueries(rawQuery, preferMalaysia)) {
    candidates.push(...(await resolveWithNominatim(query, preferredCountryCode)));
    candidates.push(...(await resolveWithPhoton(query, preferredCountryCode)));
    if (candidates.some((candidate) => candidate.score >= 12)) break;
  }

  const best = candidates.sort((left, right) => right.score - left.score)[0];
  if (!best) return NextResponse.json({ error: "Could not resolve that location." }, { status: 404 });

  return NextResponse.json(
    {
      label: best.label,
      latitude: best.latitude,
      longitude: best.longitude,
      provider: best.provider,
      country: best.country,
      countryCode: best.countryCode,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
