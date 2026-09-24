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
  priceLabel?: string;
  priceNote?: string;
  budgetFit?: "good" | "ok" | "stretch";
  reason: string;
  source: "foursquare" | "demo";
};

export type RecommendationResponse = {
  mode: "live" | "demo";
  query: string;
  interpretedQuery?: string;
  cravingIntent?: string;
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
    priceLabel: "RM12–30",
    priceNote: "typical casual meal estimate",
    budgetFit: "good",
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
    priceLabel: "RM12–30",
    priceNote: "typical casual meal estimate",
    budgetFit: "good",
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
    priceLabel: "RM12–30",
    priceNote: "typical casual meal estimate",
    budgetFit: "good",
    reason: "Keeps vegetarian options strong without forcing everyone into a niche menu.",
    source: "demo",
  },
];

export function normalizeQuery(query: string) {
  const trimmed = query.trim().replace(/\s+/g, " ");
  return trimmed || "restaurants";
}

export function interpretCraving(query: string, dietary?: string) {
  const normalized = normalizeQuery(`${query} ${dietary ?? ""}`).toLowerCase();
  const intents: Array<{ intent: string; searchQuery: string; patterns: RegExp[] }> = [
    {
      intent: "healthy / lighter food",
      searchQuery: "healthy food salad vegetarian poke bowl soup grilled",
      patterns: [/healthy|healthier|clean|light|lighter|diet|fresh|salad|健康|清淡|轻食|低卡|少油/],
    },
    {
      intent: "spicy food",
      searchQuery: "spicy food thai korean curry mala sichuan indian",
      patterns: [/spicy|hot food|mala|curry|thai|sichuan|korean|辣|麻辣|咖喱|重口味/],
    },
    {
      intent: "cheap and filling",
      searchQuery: "cheap food nasi lemak mamak kopitiam rice noodles hawker",
      patterns: [/cheap|budget|affordable|filling|value|save money|便宜|划算|经济|饱|吃饱/],
    },
    {
      intent: "sweet dessert",
      searchQuery: "dessert cake ice cream waffles cafe",
      patterns: [/sweet|dessert|cake|ice cream|waffle|甜|甜品|蛋糕|冰淇淋/],
    },
    {
      intent: "late-night food",
      searchQuery: "late night food mamak burger noodles supper",
      patterns: [/late|midnight|supper|night|宵夜|半夜|晚上/],
    },
    {
      intent: "date / comfortable place",
      searchQuery: "cafe restaurant bistro japanese western",
      patterns: [/date|romantic|comfortable|cozy|quiet|couple|约会|舒服|安静|聊天|情侣/],
    },
  ];
  const match = intents.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
  return {
    originalQuery: normalizeQuery(query),
    searchQuery: match?.searchQuery ?? normalizeQuery(query),
    intent: match?.intent,
  };
}

function estimatePriceLevel(place: Pick<Recommendation, "category" | "name" | "price">, request: RecommendationRequest) {
  if (place.price) return Math.max(1, Math.min(4, place.price));
  const text = `${place.name} ${place.category} ${request.query}`.toLowerCase();
  if (/(fine|steak|bar|grill|hotel|buffet|seafood|japanese|sushi|korean|western)/.test(text)) return 3;
  if (/(cafe|coffee|ramen|pizza|burger|restaurant|bistro|thai|chinese|indian|mexican)/.test(text)) return 2;
  if (/(nasi|lemak|kopitiam|mamak|hawker|stall|food court|warung|mee|noodle|rice)/.test(text)) return 1;
  return request.budget === "high" ? 3 : request.budget === "low" ? 1 : 2;
}

function priceRange(level: number) {
  if (level <= 1) return "RM5–15";
  if (level === 2) return "RM12–30";
  if (level === 3) return "RM25–60";
  return "RM60+";
}

function budgetFit(level: number, budget?: RecommendationRequest["budget"]): Recommendation["budgetFit"] {
  if (!budget) return "ok";
  if (budget === "low") return level <= 1 ? "good" : level === 2 ? "ok" : "stretch";
  if (budget === "medium") return level <= 2 ? "good" : level === 3 ? "ok" : "stretch";
  return level >= 3 ? "good" : "ok";
}

function withPriceGuidance(place: Recommendation, request: RecommendationRequest): Recommendation {
  const level = estimatePriceLevel(place, request);
  const apiProvidedPrice = Boolean(place.price);
  return {
    ...place,
    price: place.price ?? level,
    priceLabel: place.priceLabel ?? priceRange(level),
    priceNote: place.priceNote ?? (apiProvidedPrice ? "price level from provider" : "estimated from place type"),
    budgetFit: place.budgetFit ?? budgetFit(level, request.budget),
  };
}

export function demoRecommendations(request: RecommendationRequest, note?: string): RecommendationResponse {
  const craving = interpretCraving(request.query, request.dietary);
  const query = craving.searchQuery.toLowerCase();
  const rejectedIds = new Set(request.rejectedIds ?? []);
  const ranked = demoPlaces.filter((place) => !rejectedIds.has(place.id)).map((place) => {
    const keywordBoost = place.category.toLowerCase().includes(query) || query.includes(place.category.toLowerCase()) ? 0.4 : 0;
    const rating = place.rating ?? 8;
    return withPriceGuidance({ ...place, rating: Math.min(9.5, rating + keywordBoost) }, request);
  });

  return {
    mode: "demo",
    query: normalizeQuery(request.query),
    interpretedQuery: craving.intent ? craving.searchQuery : undefined,
    cravingIntent: craving.intent,
    locationUsed: Boolean(request.latitude && request.longitude),
    recommendations: ranked,
    decision: ranked[0],
    note: note ?? "Add FOURSQUARE_API_KEY to .env.local for live restaurant data.",
  };
}

export function scoreReason(place: Recommendation, request: RecommendationRequest) {
  const craving = interpretCraving(request.query, request.dietary);
  const parts = [craving.intent ? `Matches your ${craving.intent} craving` : `Matches "${normalizeQuery(request.query)}"`];
  if (place.distanceMeters) parts.push(`${Math.round(place.distanceMeters)}m away`);
  if (place.priceLabel) parts.push(`${place.priceLabel}${place.priceNote?.includes("estimated") ? " est." : ""}`);
  if (place.budgetFit === "good") parts.push("fits budget");
  if (place.budgetFit === "stretch") parts.push("may stretch budget");
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
      const leftFit = left.budgetFit === "good" ? 10 : left.budgetFit === "ok" ? 3 : -12;
      const rightFit = right.budgetFit === "good" ? 10 : right.budgetFit === "ok" ? 3 : -12;
      const leftScore = (left.rating ?? 7) * 10 - (left.distanceMeters ?? 1200) / 250 + leftFit;
      const rightScore = (right.rating ?? 7) * 10 - (right.distanceMeters ?? 1200) / 250 + rightFit;
      return rightScore - leftScore;
    });
}

export function mapFoursquarePlace(place: FoursquarePlace, request: RecommendationRequest): Recommendation {
  const address = place.location?.formatted_address ?? place.location?.address ?? [place.location?.locality, place.location?.region].filter(Boolean).join(", ");
  const result = withPriceGuidance({
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
  }, request);
  result.reason = scoreReason(result, request);
  return result;
}
