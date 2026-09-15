import { NextResponse } from "next/server";
import {
  demoRecommendations,
  type FoursquarePlace,
  mapFoursquarePlace,
  normalizeQuery,
  rankRecommendations,
  type RecommendationRequest,
} from "@/lib/recommendations";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

type FoursquareSearchResponse = {
  results?: unknown[];
  context?: {
    geo_bounds?: {
      circle?: {
        center?: {
          latitude?: number;
          longitude?: number;
        };
      };
    };
  };
};

type GeocodedArea = {
  label: string;
  latitude: number;
  longitude: number;
};

const fallbackLocation = {
  latitude: Number(process.env.DEFAULT_SEARCH_LATITUDE ?? 1.519901),
  longitude: Number(process.env.DEFAULT_SEARCH_LONGITUDE ?? 103.6586369),
  label: process.env.DEFAULT_SEARCH_LABEL ?? "Taman Ungku Tun Aminah",
};

const knownAreas = [
  {
    label: "Taman Ungku Tun Aminah",
    latitude: 1.519901,
    longitude: 103.6586369,
    patterns: ["tun aminah", "dun aminah", "tun amina", "dun amina", "tuta", "taman ungku tun aminah"],
  },
  {
    label: "Kota Kinabalu, Sabah",
    latitude: 5.9804,
    longitude: 116.0735,
    patterns: ["kota kinabalu", "kk sabah", "kinabalu"],
  },
  {
    label: "Miri, Sarawak",
    latitude: 4.3995,
    longitude: 113.9914,
    patterns: ["miri", "美里"],
  },
  {
    label: "Kuching, Sarawak",
    latitude: 1.5533,
    longitude: 110.3592,
    patterns: ["kuching", "古晋"],
  },
  {
    label: "Johor Bahru, Johor",
    latitude: 1.4927,
    longitude: 103.7414,
    patterns: ["johor bahru", "jb", "新山"],
  },
  {
    label: "Kuala Lumpur",
    latitude: 3.1478,
    longitude: 101.6953,
    patterns: ["kuala lumpur", "kl", "吉隆坡"],
  },
];

function isFiniteCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function findKnownArea(text: string) {
  const normalized = text.toLowerCase();
  return knownAreas.find((area) => area.patterns.some((pattern) => normalized.includes(pattern)));
}

async function geocodeArea(area: string): Promise<GeocodedArea | null> {
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("q", area);

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "DecideEats hackathon demo",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = payload[0];
    if (!first?.lat || !first.lon) return null;
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      label: first.display_name ?? area,
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
}

function readRequest(value: unknown): RecommendationRequest {
  if (!value || typeof value !== "object") return { query: "restaurants" };
  const body = value as Record<string, unknown>;
  const rejectedIds = Array.isArray(body.rejectedIds)
    ? body.rejectedIds.filter((item): item is string => typeof item === "string").slice(0, 20)
    : undefined;
  return {
    query: typeof body.query === "string" ? body.query : "restaurants",
    area: typeof body.area === "string" ? body.area.trim().slice(0, 80) : undefined,
    latitude: isFiniteCoordinate(body.latitude, -90, 90) ? body.latitude : undefined,
    longitude: isFiniteCoordinate(body.longitude, -180, 180) ? body.longitude : undefined,
    budget: body.budget === "low" || body.budget === "medium" || body.budget === "high" ? body.budget : undefined,
    partySize: typeof body.partySize === "number" && Number.isFinite(body.partySize) ? Math.max(1, Math.min(12, Math.round(body.partySize))) : undefined,
    dietary: typeof body.dietary === "string" ? body.dietary.trim().slice(0, 80) : undefined,
    rejectedIds,
  };
}

export async function POST(request: Request) {
  const limit = rateLimit(requestKey(request, "recommendation"), 40, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many recommendation searches. Please try again in a minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const recommendationRequest = readRequest(body);
  const apiKey = process.env.FOURSQUARE_API_KEY;
  const query = normalizeQuery(recommendationRequest.query);

  if (!apiKey) {
    return NextResponse.json(demoRecommendations(recommendationRequest), { headers: { "Cache-Control": "no-store" } });
  }

  const areaMatch = findKnownArea(`${recommendationRequest.area ?? ""} ${query}`);
  const manualArea = recommendationRequest.area?.trim();
  const hasUserLocation = Boolean(recommendationRequest.latitude && recommendationRequest.longitude);
  const geocodedArea = !hasUserLocation && !areaMatch && manualArea ? await geocodeArea(manualArea) : null;
  const shouldUseNearSearch = !hasUserLocation && !areaMatch && !geocodedArea && Boolean(manualArea);
  const searchLatitude = recommendationRequest.latitude ?? areaMatch?.latitude ?? geocodedArea?.latitude ?? fallbackLocation.latitude;
  const searchLongitude = recommendationRequest.longitude ?? areaMatch?.longitude ?? geocodedArea?.longitude ?? fallbackLocation.longitude;
  const areaUsed = hasUserLocation ? "Your browser location" : areaMatch?.label ?? manualArea ?? geocodedArea?.label ?? fallbackLocation.label;

  const endpoint = new URL("https://places-api.foursquare.com/places/search");
  endpoint.searchParams.set("query", query);
  if (shouldUseNearSearch && manualArea) {
    endpoint.searchParams.set("near", manualArea);
  } else {
    endpoint.searchParams.set("ll", `${searchLatitude},${searchLongitude}`);
  }
  endpoint.searchParams.set("radius", "3000");
  endpoint.searchParams.set("limit", "8");
  endpoint.searchParams.set("sort", "POPULARITY");

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Places-Api-Version": process.env.FOURSQUARE_API_VERSION ?? "2025-06-17",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Foursquare search failed", response.status);
      return NextResponse.json(
        demoRecommendations(recommendationRequest, "Foursquare did not return live results, so demo data is shown."),
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const payload = (await response.json()) as FoursquareSearchResponse;
    const places = Array.isArray(payload.results)
      ? payload.results.map((place) => mapFoursquarePlace(place as FoursquarePlace, recommendationRequest))
      : [];
    const rankedPlaces = rankRecommendations(places, recommendationRequest).slice(0, 3);
    const resolvedCenter = payload.context?.geo_bounds?.circle?.center;
    const resolvedAreaUsed = shouldUseNearSearch && resolvedCenter ? areaUsed : areaUsed;

    if (rankedPlaces.length === 0) {
      return NextResponse.json(
        demoRecommendations(recommendationRequest, "No live restaurants matched this query, so demo data is shown."),
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        mode: "live",
        query,
        areaUsed: resolvedAreaUsed,
        locationUsed: hasUserLocation,
        recommendations: rankedPlaces,
        decision: rankedPlaces[0],
        note: hasUserLocation ? undefined : `Using ${resolvedAreaUsed} as the live search area.`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      demoRecommendations(recommendationRequest, "Restaurant provider is unavailable, so demo data is shown."),
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
