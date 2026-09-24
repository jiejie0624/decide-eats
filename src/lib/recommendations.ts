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

function budgetFit(level: number, budget?: RecommendationRequest["budget"]): Recommendation["budgetFit"] {
  if (!budget) return "ok";
  if (budget === "low") return level <= 1 ? "good" : level === 2 ? "ok" : "stretch";
  if (budget === "medium") return level <= 2 ? "good" : level === 3 ? "ok" : "stretch";
  return level >= 3 ? "good" : "ok";
}

function coordinatesIn(request: RecommendationRequest, bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
  return (
    typeof request.latitude === "number" &&
    typeof request.longitude === "number" &&
    request.latitude >= bounds.minLat &&
    request.latitude <= bounds.maxLat &&
    request.longitude >= bounds.minLon &&
    request.longitude <= bounds.maxLon
  );
}

function detectCurrency(request: RecommendationRequest) {
  const area = `${request.area ?? ""} ${request.query}`.toLowerCase();
  if (/(united states|usa|u\.s\.|america|new york|los angeles|san francisco|chicago|seattle|boston)/.test(area) || coordinatesIn(request, { minLat: 24, maxLat: 50, minLon: -125, maxLon: -66 })) {
    return { code: "USD", ranges: ["$5–12", "$12–25", "$25–50", "$50+"] };
  }
  if (/(china|中国|beijing|北京|shanghai|上海|guangzhou|广州|shenzhen|深圳|chengdu|成都)/.test(area) || coordinatesIn(request, { minLat: 18, maxLat: 54, minLon: 73, maxLon: 135 })) {
    return { code: "CNY", ranges: ["¥20–50", "¥50–100", "¥100–200", "¥200+"] };
  }
  if (/(singapore|新加坡)/.test(area) || coordinatesIn(request, { minLat: 1.15, maxLat: 1.5, minLon: 103.55, maxLon: 104.1 })) {
    return { code: "SGD", ranges: ["S$5–12", "S$12–25", "S$25–50", "S$50+"] };
  }
  if (/(japan|日本|tokyo|東京|osaka|大阪|kyoto|京都)/.test(area) || coordinatesIn(request, { minLat: 30, maxLat: 46, minLon: 129, maxLon: 146 })) {
    return { code: "JPY", ranges: ["¥600–1,200", "¥1,200–2,500", "¥2,500–5,000", "¥5,000+"] };
  }
  if (/(korea|south korea|韩国|韓國|seoul|首尔|首爾)/.test(area) || coordinatesIn(request, { minLat: 33, maxLat: 39, minLon: 124, maxLon: 132 })) {
    return { code: "KRW", ranges: ["₩7k–15k", "₩15k–30k", "₩30k–60k", "₩60k+"] };
  }
  if (/(thailand|泰国|泰國|bangkok|曼谷)/.test(area) || coordinatesIn(request, { minLat: 5, maxLat: 21, minLon: 97, maxLon: 106 })) {
    return { code: "THB", ranges: ["฿60–150", "฿150–350", "฿350–800", "฿800+"] };
  }
  if (/(indonesia|印尼|jakarta|雅加达|bali|巴厘)/.test(area) || coordinatesIn(request, { minLat: -11, maxLat: 6, minLon: 95, maxLon: 141 })) {
    return { code: "IDR", ranges: ["Rp20k–50k", "Rp50k–120k", "Rp120k–250k", "Rp250k+"] };
  }
  if (/(philippines|菲律宾|菲律賓|manila|马尼拉)/.test(area) || coordinatesIn(request, { minLat: 4, maxLat: 22, minLon: 116, maxLon: 127 })) {
    return { code: "PHP", ranges: ["₱100–250", "₱250–600", "₱600–1,200", "₱1,200+"] };
  }
  if (/(united kingdom|uk|england|london|英国|英國)/.test(area) || coordinatesIn(request, { minLat: 49, maxLat: 59, minLon: -8, maxLon: 2 })) {
    return { code: "GBP", ranges: ["£5–12", "£12–25", "£25–50", "£50+"] };
  }
  if (/(europe|france|germany|italy|spain|netherlands|paris|berlin|rome|madrid|欧洲|歐洲|法国|德國|德国|意大利|西班牙)/.test(area)) {
    return { code: "EUR", ranges: ["€6–12", "€12–25", "€25–50", "€50+"] };
  }
  return { code: "MYR", ranges: ["RM5–15", "RM12–30", "RM25–60", "RM60+"] };
}

function withPriceGuidance(place: Recommendation, request: RecommendationRequest): Recommendation {
  const level = estimatePriceLevel(place, request);
  const apiProvidedPrice = Boolean(place.price);
  const currency = detectCurrency(request);
  return {
    ...place,
    price: place.price ?? level,
    priceLabel: place.priceLabel ?? currency.ranges[Math.max(1, Math.min(4, level)) - 1],
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
    const result = withPriceGuidance({ ...place, rating: Math.min(9.5, rating + keywordBoost) }, request);
    return { ...result, reason: scoreReason(result, request) };
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
  const seed = `${place.id}-${request.query}-${request.budget ?? ""}-${request.partySize ?? ""}-${new Date().getMinutes()}`;
  const pick = <T,>(items: T[], offset = 0) => items[(Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) + offset) % items.length];
  const cravingLine = craving.intent
    ? pick([
        `It fits the ${craving.intent} mood you described without making the choice feel too random.`,
        `This is a strong match for your ${craving.intent} craving, so it should feel closer to what you actually asked for.`,
        `I picked it because your request sounds more like ${craving.intent} than a specific dish.`,
      ])
    : pick([
        `It lines up well with “${normalizeQuery(request.query)}” and keeps the decision simple.`,
        `This feels like the safest match for what you asked, without sending you through ten options.`,
        `It is a direct fit for your craving and should be easy to agree on.`,
      ]);

  const valueLines = [
    place.budgetFit === "good" && place.priceLabel ? `The price looks reasonable for your budget at around ${place.priceLabel}.` : "",
    place.budgetFit === "stretch" && place.priceLabel ? `It may cost a little more at around ${place.priceLabel}, but it looks more worthwhile than a random cheap pick.` : "",
    place.distanceMeters ? `It is also close enough at about ${Math.round(place.distanceMeters)}m away, so you do not waste time traveling.` : "",
    place.rating ? `The rating signal is decent too, so it is not just a random nearby place.` : "",
    request.partySize && request.partySize > 2 ? `For ${request.partySize} people, it feels like a safer group choice than something too niche.` : "",
    request.dietary ? `It also tries to respect your ${request.dietary} preference.` : "",
    `It gives a good balance between taste, convenience, and effort.`,
    `It feels like the kind of place that can satisfy the craving without overcomplicating dinner.`,
  ].filter(Boolean);

  return `${cravingLine} ${pick(valueLines, 17)}`;
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
