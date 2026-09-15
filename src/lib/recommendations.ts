export type RecommendationRequest = {
  query: string;
  latitude?: number;
  longitude?: number;
  area?: string;
  budget?: "low" | "medium" | "high";
  partySize?: number;
  dietary?: string;
  rejectedIds?: string[];
};

export type Recommendation = {
  id: string;
  name: string;
  address: string;
  category: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  rating?: number;
  price?: number;
  reason: string;
  source: "foursquare" | "demo";
};

export type RecommendationResponse = {
  mode: "live" | "demo";
  query: string;
  areaUsed?: string;
  locationUsed: boolean;
  recommendations: Recommendation[];
  decision?: Recommendation;
  note?: string;
};

export type FoursquarePlace = {
  fsq_place_id?: string;
  name?: string;
  distance?: number;
  rating?: number;
  price?: number;
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
  };
  latitude?: number;
  longitude?: number;
  geocodes?: {
    main?: {
      latitude?: number;
      longitude?: number;
    };
  };
  categories?: Array<{ name?: string }>;
};

const demoPlaces: Recommendation[] = [
  {
    id: "demo-ramen",
    name: "Broth & Noodle Counter",
    address: "Demo result near your selected area",
    category: "Ramen",
    distanceMeters: 420,
    rating: 8.8,
    price: 2,
    reason: "Best match when the group wants something warm, fast, and easy to share.",
    source: "demo",
  },
  {
    id: "demo-tacos",
    name: "Corner Taco Kitchen",
    address: "Demo result near your selected area",
    category: "Mexican",
    distanceMeters: 680,
    rating: 8.5,
    price: 2,
    reason: "Good compromise pick for mixed preferences and a casual budget.",
    source: "demo",
  },
  {
    id: "demo-veggie",
    name: "Green Table Cafe",
    address: "Demo result near your selected area",
    category: "Vegetarian",
    distanceMeters: 910,
    rating: 8.3,
    price: 2,
    reason: "Keeps vegetarian options strong without forcing everyone into a niche menu.",
    source: "demo",
  },
];

export function normalizeQuery(query: string) {
  const trimmed = query.trim().replace(/\s+/g, " ");
  return trimmed || "restaurants";
}

export function demoRecommendations(request: RecommendationRequest, note?: string): RecommendationResponse {
  const query = normalizeQuery(request.query).toLowerCase();
  const rejectedIds = new Set(request.rejectedIds ?? []);
  const ranked = demoPlaces.filter((place) => !rejectedIds.has(place.id)).map((place) => {
    const keywordBoost = place.category.toLowerCase().includes(query) || query.includes(place.category.toLowerCase()) ? 0.4 : 0;
    const rating = place.rating ?? 8;
    return { ...place, rating: Math.min(9.5, rating + keywordBoost) };
  });

  return {
    mode: "demo",
    query: normalizeQuery(request.query),
    locationUsed: Boolean(request.latitude && request.longitude),
    recommendations: ranked,
    decision: ranked[0],
    note: note ?? "Add FOURSQUARE_API_KEY to .env.local for live restaurant data.",
  };
}

export function scoreReason(place: Recommendation, request: RecommendationRequest) {
  const parts = [`Matches "${normalizeQuery(request.query)}"`];
  if (place.distanceMeters) parts.push(`${Math.round(place.distanceMeters)}m away`);
  if (place.rating) parts.push(`${place.rating.toFixed(1)}/10 rating`);
  if (request.partySize && request.partySize > 2) parts.push("reasonable group pick");
  if (request.dietary) parts.push(`dietary note: ${request.dietary}`);
  return parts.join(" · ");
}

export function rankRecommendations(places: Recommendation[], request: RecommendationRequest) {
  const rejectedIds = new Set(request.rejectedIds ?? []);
  return places
    .filter((place) => !rejectedIds.has(place.id))
    .sort((left, right) => {
      const leftScore = (left.rating ?? 7) * 10 - (left.distanceMeters ?? 1200) / 250 + (left.price && request.budget === "low" && left.price <= 2 ? 8 : 0);
      const rightScore = (right.rating ?? 7) * 10 - (right.distanceMeters ?? 1200) / 250 + (right.price && request.budget === "low" && right.price <= 2 ? 8 : 0);
      return rightScore - leftScore;
    });
}

export function mapFoursquarePlace(place: FoursquarePlace, request: RecommendationRequest): Recommendation {
  const address = place.location?.formatted_address ?? place.location?.address ?? [place.location?.locality, place.location?.region].filter(Boolean).join(", ");
  const result: Recommendation = {
    id: place.fsq_place_id ?? place.name ?? crypto.randomUUID(),
    name: place.name ?? "Unnamed restaurant",
    address: address || "Address unavailable",
    category: place.categories?.[0]?.name ?? "Restaurant",
    latitude: place.geocodes?.main?.latitude ?? place.latitude,
    longitude: place.geocodes?.main?.longitude ?? place.longitude,
    distanceMeters: place.distance,
    rating: place.rating,
    price: place.price,
    reason: "",
    source: "foursquare",
  };
  result.reason = scoreReason(result, request);
  return result;
}
