"use client";

import { Brain, ChevronDown, ExternalLink, LocateFixed, MapPinned, Mic, Search, ShoppingBag, Sparkles, ThumbsDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Recommendation, RecommendationResponse } from "@/lib/recommendations";
import { createInlineVoiceSession } from "@/lib/voice-agent-session";

type Status = "idle" | "connecting" | "listening" | "speaking" | "error";
type Budget = "low" | "medium" | "high";
type AreaSource = "empty" | "browser" | "manual" | "voice";
type ToolArguments = { query?: string; latitude?: number; longitude?: number; area?: string; budget?: Budget; partySize?: number; dietary?: string; rejectedIds?: string[] };
type BrainStep = { id: number; label: string; detail: string };
type ResolvedLocation = { label: string; latitude: number; longitude: number; provider?: string };
type AgentEvent = {
  type: string;
  text?: string;
  data?: string;
  message?: string;
  status?: string;
  name?: string;
  call_id?: string;
  arguments?: ToolArguments | string;
};

const budgetOptions: Array<{ value: Budget; label: string }> = [
  { value: "low", label: "Easy" },
  { value: "medium", label: "Comfort" },
  { value: "high", label: "Worth it" },
];

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let result = "";
  for (let i = 0; i < bytes.length; i += 0x8000) result += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(result);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const result = new Int16Array(binary.length / 2);
  for (let i = 0; i < result.length; i += 1) result[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
  return result;
}

function statusLabel(status: Status) {
  const labels: Record<Status, string> = {
    idle: "Tap the orb, speak your craving, get one clean decision.",
    connecting: "Requesting location and microphone permission...",
    listening: "Listening to your craving...",
    speaking: "DecideEats is thinking out loud...",
    error: "Voice needs attention",
  };
  return labels[status];
}

function priceLabel(place: Recommendation) {
  if (place.priceLabel) return `${place.priceLabel}${place.priceNote?.includes("estimated") ? " estimated" : ""}`;
  if (!place.price) return "Price estimate unavailable";
  return "$".repeat(Math.max(1, Math.min(4, place.price)));
}

function budgetLabel(place: Recommendation) {
  if (place.budgetFit === "good") return "Fits budget";
  if (place.budgetFit === "stretch") return "May stretch budget";
  return "Budget okay";
}

function directionsUrl(place: Recommendation, origin?: string) {
  const destination = place.latitude && place.longitude ? `${place.latitude},${place.longitude}` : `${place.name} ${place.address}`;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destination);
  if (origin) url.searchParams.set("origin", origin);
  return url.toString();
}

function deliverySearchLinks(place: Recommendation, area?: string) {
  const search = [place.name, area, "delivery"].filter(Boolean).join(" ");
  return [
    { label: "Foodpanda", url: `https://www.google.com/search?q=${encodeURIComponent(`Foodpanda ${search}`)}` },
    { label: "GrabFood", url: `https://www.google.com/search?q=${encodeURIComponent(`GrabFood ${search}`)}` },
    { label: "Google", url: `https://www.google.com/search?q=${encodeURIComponent(search)}` },
  ];
}

function isRecommendationResponse(payload: RecommendationResponse | { error?: string }): payload is RecommendationResponse {
  return "recommendations" in payload && Array.isArray(payload.recommendations);
}

function readToolArguments(value: ToolArguments | string | undefined): ToolArguments {
  if (!value) return {};
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ToolArguments) : {};
  } catch {
    return { query: value };
  }
}

function responseNote(payload: RecommendationResponse) {
  const intentNote = payload.cravingIntent ? `Understood as ${payload.cravingIntent}.` : "";
  return [intentNote, payload.note].filter(Boolean).join(" ");
}

function withLocationTimeout(promise: Promise<{ latitude: number; longitude: number } | null>, onTimeout: () => void, timeoutMs = 1500) {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      window.setTimeout(() => {
        onTimeout();
        resolve(null);
      }, timeoutMs);
    }),
  ]);
}

function extractPartySize(text: string) {
  const normalized = text.toLowerCase();
  const chineseDigits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (/(just me|only me|alone|solo|by myself|myself|一个人|一個人|我自己|自己吃|seorang|satu orang)/i.test(text)) return 1;
  const explicitNumber = normalized.match(/\b([1-9]|1[0-2])\s*(people|person|pax|of us|persons|orang)\b/);
  if (explicitNumber) return Number(explicitNumber[1]);
  const forNumber = normalized.match(/\b(for|we are|we're|kami|kita)\s+([1-9]|1[0-2])\b/);
  if (forNumber) return Number(forNumber[2]);
  const wordNumbers: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    satu: 1,
    dua: 2,
    tiga: 3,
    empat: 4,
    lima: 5,
    enam: 6,
  };
  for (const [word, size] of Object.entries(wordNumbers)) {
    if (new RegExp(`\\b${word}\\s+(people|person|pax|of us|orang)\\b`, "i").test(text)) return size;
  }
  const chineseMatch = text.match(/([一二两兩三四五六七八九十])\s*(个|個)?\s*人/);
  if (chineseMatch) return chineseDigits[chineseMatch[1]];
  return null;
}

function extractBudget(text: string): Budget | null {
  if (/(cheap|easy budget|budget|affordable|not expensive|murah|便宜|省钱|省錢)/i.test(text)) return "low";
  if (/(comfortable|normal|medium|average|biasa|普通|舒服|中等)/i.test(text)) return "medium";
  if (/(premium|worth it|expensive|mahal|高级|高級|贵一点|貴一點)/i.test(text)) return "high";
  return null;
}

function extractDietary(text: string) {
  const matches = text.match(/(halal|vegan|vegetarian|gluten[- ]?free|no pork|no beef|allergy|allergic|清真|素食|不要猪肉|不要豬肉|不吃猪|不吃豬|tak makan babi|tak makan lembu)/gi);
  return matches ? Array.from(new Set(matches.map((item) => item.trim()))).join(", ") : "";
}

function extractSpokenArea(text: string) {
  const patterns = [
    /\b(?:i live in|i am in|i'm in|im in|i stay in|i am from|i'm from|im from|near|around|area is|location is|search in)\s+([^,.!?，。！？]+?)(?:\s+(?:for|and|with|want|wanna|looking|eat|makan)\b|[,.!?，。！？]|$)/i,
    /\b(?:di|dekat|area|lokasi)\s+([^,.!?，。！？]+?)(?:\s+(?:nak|makan|untuk|and|with)\b|[,.!?，。！？]|$)/i,
    /(?:我在|我住在|我来自|我來自|地点是|地點是|位置是|地区是|地區是|附近在)\s*([^，。！？,.!?]+?)(?:\s*(?:想|吃|找|，|。|,|\.|$))/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim().replace(/\s+(restaurant|food|place|places|餐厅|餐廳|美食)$/i, "");
    if (value && value.length >= 2 && value.length <= 60) return value;
  }
  return "";
}

export function VoiceExperience() {
  const [status, setStatus] = useState<Status>("idle");
  const [userText, setUserText] = useState("");
  const [agentText, setAgentText] = useState("");
  const [query, setQuery] = useState("sushi for two");
  const [error, setError] = useState("");
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [decision, setDecision] = useState<Recommendation | null>(null);
  const [recommendationMode, setRecommendationMode] = useState<"live" | "demo">("demo");
  const [recommendationNote, setRecommendationNote] = useState("");
  const [areaUsed, setAreaUsed] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [toolStatus, setToolStatus] = useState("");
  const [budget, setBudget] = useState<Budget>("medium");
  const [partySize, setPartySize] = useState(2);
  const [, setPartySizeKnown] = useState(false);
  const [dietary, setDietary] = useState("");
  const [area, setArea] = useState("");
  const [areaSource, setAreaSource] = useState<AreaSource>("empty");
  const [expandedPlaceId, setExpandedPlaceId] = useState<string | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [brainSteps, setBrainSteps] = useState<BrainStep[]>([
    { id: 1, label: "Ready", detail: "Waiting for a craving, area, budget, people count, and dietary needs." },
  ]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [locationStatus, setLocationStatus] = useState<"idle" | "asking" | "ready" | "fallback">("idle");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const context = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const worklet = useRef<AudioWorkletNode | null>(null);
  const ready = useRef(false);
  const playbackTime = useRef(0);
  const outputs = useRef<AudioBufferSourceNode[]>([]);
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const areaRef = useRef("");
  const areaSourceRef = useRef<AreaSource>("empty");
  const locationStatusRef = useRef<"idle" | "asking" | "ready" | "fallback">("idle");
  const locationRequestAttemptedRef = useRef(false);
  const partySizeKnownRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const conversationEpochRef = useRef(0);
  const activeReplyEpochRef = useRef(-1);
  const pendingToolResults = useRef<Array<{ call_id: string; result: RecommendationResponse | { error: string } }>>([]);
  const rejectedIdsRef = useRef<string[]>([]);

  const updateAreaSource = useCallback((source: AreaSource) => {
    areaSourceRef.current = source;
    setAreaSource(source);
  }, []);

  const addBrainStep = useCallback((label: string, detail: string) => {
    setBrainSteps((steps) => [...steps, { id: Date.now() + steps.length, label, detail }].slice(-6));
  }, []);

  const updatePartySize = useCallback((value: number, known = true) => {
    const nextValue = Math.max(1, Math.min(12, Math.round(value) || 1));
    setPartySize(nextValue);
    if (known) {
      partySizeKnownRef.current = true;
      setPartySizeKnown(true);
    }
    return nextValue;
  }, []);

  const clearPlayback = useCallback(() => {
    outputs.current.forEach((item) => {
      try {
        item.stop();
      } catch {
        // The audio node may already have ended.
      }
    });
    outputs.current = [];
    if (context.current) playbackTime.current = context.current.currentTime;
  }, []);

  const stop = useCallback(() => {
    ready.current = false;
    userSpeakingRef.current = false;
    activeReplyEpochRef.current = -1;
    conversationEpochRef.current += 1;
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: "session.end" }));
    ws.current?.close();
    ws.current = null;
    clearPlayback();
    worklet.current?.disconnect();
    stream.current?.getTracks().forEach((track) => track.stop());
    void context.current?.close();
    worklet.current = null;
    stream.current = null;
    context.current = null;
    setStatus("idle");
  }, [clearPlayback]);

  const play = useCallback((encoded: string) => {
    const audio = context.current;
    if (!audio || userSpeakingRef.current || activeReplyEpochRef.current !== conversationEpochRef.current) return;
    const pcm = fromBase64(encoded);
    const buffer = audio.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 32768;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    const startAt = Math.max(audio.currentTime, playbackTime.current);
    if (userSpeakingRef.current || activeReplyEpochRef.current !== conversationEpochRef.current) return;
    source.start(startAt);
    playbackTime.current = startAt + buffer.duration;
    outputs.current.push(source);
    source.onended = () => {
      outputs.current = outputs.current.filter((item) => item !== source);
    };
  }, []);

  const fillAreaFromCoordinates = useCallback(async (coordinates: { latitude: number; longitude: number }, overwrite = false) => {
    try {
      const response = await fetch(`/api/reverse-geocode?lat=${coordinates.latitude}&lon=${coordinates.longitude}`, { cache: "no-store" });
      const payload = response.ok ? ((await response.json()) as { label?: string }) : null;
      const label = payload?.label?.trim();
      if (!label) return;
      if (!overwrite && (areaSourceRef.current === "manual" || areaSourceRef.current === "voice")) return;
      updateAreaSource("browser");
      areaRef.current = label;
      setArea(label);
      addBrainStep("Location", `Browser location resolved as ${label}.`);
    } catch {
      // Coordinates are still usable even if the readable label fails.
    }
  }, [addBrainStep, updateAreaSource]);

  const requestLocation = useCallback(async (forceBrowserArea = false) => {
    locationRequestAttemptedRef.current = true;
    if (locationRef.current && !forceBrowserArea) {
      setLocationStatus("ready");
      locationStatusRef.current = "ready";
      return locationRef.current;
    }
    if (!navigator.geolocation) {
      setLocationStatus("fallback");
      locationStatusRef.current = "fallback";
      return null;
    }
    setLocationStatus("asking");
    locationStatusRef.current = "asking";
    return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setLocation(next);
          locationRef.current = next;
          setLocationStatus("ready");
          locationStatusRef.current = "ready";
          void fillAreaFromCoordinates(next, forceBrowserArea);
          resolve(next);
        },
        () => {
          setLocationStatus("fallback");
          locationStatusRef.current = "fallback";
          resolve(null);
        },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
      );
    });
  }, [fillAreaFromCoordinates]);

  const resolveSpokenArea = useCallback(async (spokenArea: string) => {
    const cleanArea = spokenArea.trim();
    if (!cleanArea) return null;
    try {
      const response = await fetch("/api/resolve-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanArea }),
      });
      const payload = (await response.json()) as ResolvedLocation | { error?: string };
      if (!response.ok || !("label" in payload)) return null;
      updateAreaSource("voice");
      areaRef.current = payload.label;
      setArea(payload.label);
      const coordinates = { latitude: payload.latitude, longitude: payload.longitude };
      locationRef.current = coordinates;
      setLocation(coordinates);
      setLocationStatus("ready");
      locationStatusRef.current = "ready";
      addBrainStep("Location", `Resolved "${cleanArea}" as ${payload.label}.`);
      return payload;
    } catch {
      return null;
    }
  }, [addBrainStep, updateAreaSource]);

  const applyTranscriptHints = useCallback((text: string) => {
    const nextPartySize = extractPartySize(text);
    if (nextPartySize) {
      updatePartySize(nextPartySize);
      addBrainStep("People", `Detected ${nextPartySize} ${nextPartySize === 1 ? "person" : "people"} from your voice.`);
    }

    const nextBudget = extractBudget(text);
    if (nextBudget) setBudget(nextBudget);

    const nextDietary = extractDietary(text);
    if (nextDietary) setDietary(nextDietary);

    const spokenArea = extractSpokenArea(text);
    if (spokenArea) {
      updateAreaSource("voice");
      areaRef.current = spokenArea;
      setArea(spokenArea);
      setLocation(null);
      locationRef.current = null;
      setLocationStatus("idle");
      void resolveSpokenArea(spokenArea);
    }
  }, [addBrainStep, resolveSpokenArea, updateAreaSource, updatePartySize]);

  const findRecommendations = useCallback(async () => {
    setRecommendationError("");
    setIsSearching(true);
    addBrainStep("Manual search", `Searching "${query.trim() || userText.trim() || "restaurants"}" for ${partySize} people with ${budget} budget${dietary.trim() ? ` and ${dietary.trim()} needs` : ""}.`);
    try {
      const areaText = area.trim();
      const isBrowserArea = areaSourceRef.current === "browser";
      const latestLocation = areaText && !isBrowserArea ? null : location ?? (await withLocationTimeout(requestLocation(), () => setLocationStatus("fallback")));
      const response = await fetch("/api/recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim() || userText.trim() || "restaurants",
          latitude: latestLocation?.latitude,
          longitude: latestLocation?.longitude,
          area: areaText || userText,
          budget,
          partySize,
          dietary: dietary.trim() || undefined,
          rejectedIds: rejectedIdsRef.current,
        }),
      });
      const payload = (await response.json()) as RecommendationResponse | { error?: string };
      if (!response.ok || !isRecommendationResponse(payload)) {
        throw new Error("error" in payload ? payload.error : "Unable to search restaurants.");
      }
      setRecommendations(payload.recommendations);
      setDecision(payload.decision ?? payload.recommendations[0] ?? null);
      setRecommendationMode(payload.mode);
      setAreaUsed(payload.areaUsed ?? "");
      setRecommendationNote(responseNote(payload));
      addBrainStep("Result", `${payload.recommendations.length} places returned. Picked ${payload.decision?.name ?? payload.recommendations[0]?.name ?? "a match"}.`);
      setExpandedPlaceId(null);
      setDeliveryOpen(false);
    } catch (caught) {
      setRecommendationError(caught instanceof Error ? caught.message : "Unable to search restaurants.");
    } finally {
      setIsSearching(false);
    }
  }, [addBrainStep, area, budget, dietary, location, partySize, query, requestLocation, userText]);

  const runRecommendationTool = useCallback(async (message: AgentEvent) => {
    if (message.name !== "get_recommendation" || !message.call_id) return;
    setToolStatus("Voice agent is searching restaurants...");
    const args = readToolArguments(message.arguments);
    addBrainStep("Tool call", `get_recommendation ${JSON.stringify(args).slice(0, 140)}`);
    const latestLocation = locationRef.current;
    const spokenArea = typeof args.area === "string" ? args.area.trim() : "";
    const currentArea = areaRef.current.trim();
    const resolvedSpokenArea = spokenArea ? await resolveSpokenArea(spokenArea) : null;
    const nextArea = resolvedSpokenArea?.label ?? (spokenArea || currentArea || userText.trim());
    const nextBudget = args.budget ?? budget;
    const nextPartySize =
      typeof args.partySize === "number" && Number.isFinite(args.partySize)
        ? Math.max(1, Math.min(12, Math.round(args.partySize)))
        : partySize;
    const nextDietary = typeof args.dietary === "string" && args.dietary.trim() ? args.dietary.trim() : dietary.trim() || undefined;
    if (spokenArea) {
      updateAreaSource("voice");
      areaRef.current = resolvedSpokenArea?.label ?? spokenArea;
      setArea(resolvedSpokenArea?.label ?? spokenArea);
      if (!resolvedSpokenArea) {
        setLocation(null);
        locationRef.current = null;
        setLocationStatus("idle");
      }
    }
    if (args.query) setQuery(args.query);
    if (args.budget) setBudget(args.budget);
    if (typeof args.partySize === "number" && Number.isFinite(args.partySize)) updatePartySize(nextPartySize);
    if (typeof args.dietary === "string" && args.dietary.trim()) setDietary(args.dietary.trim());
    try {
      const response = await fetch("/api/recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: args.query ?? (query.trim() || userText.trim() || "restaurants"),
          latitude: args.latitude ?? resolvedSpokenArea?.latitude ?? (spokenArea ? undefined : latestLocation?.latitude),
          longitude: args.longitude ?? resolvedSpokenArea?.longitude ?? (spokenArea ? undefined : latestLocation?.longitude),
          area: nextArea,
          budget: nextBudget,
          partySize: nextPartySize,
          dietary: nextDietary,
          rejectedIds: args.rejectedIds ?? rejectedIdsRef.current,
        }),
      });
      const payload = (await response.json()) as RecommendationResponse | { error?: string };
      const result: RecommendationResponse | { error: string } = response.ok && isRecommendationResponse(payload) ? payload : { error: "Unable to search restaurants." };
      pendingToolResults.current.push({ call_id: message.call_id, result });
      if ("recommendations" in result) {
        setRecommendations(result.recommendations);
        setDecision(result.decision ?? result.recommendations[0] ?? null);
        setRecommendationMode(result.mode);
        setAreaUsed(result.areaUsed ?? "");
        setRecommendationNote(responseNote(result) || "Voice agent searched restaurants.");
        addBrainStep("Tool result", `${result.recommendations.length} places returned. Picked ${result.decision?.name ?? result.recommendations[0]?.name ?? "a match"}.`);
        setExpandedPlaceId(null);
        setDeliveryOpen(false);
      }
    } catch {
      pendingToolResults.current.push({ call_id: message.call_id, result: { error: "Restaurant search is unavailable." } });
      addBrainStep("Tool error", "Restaurant search was unavailable, so the agent used the safe fallback path.");
    } finally {
      setToolStatus("Search result ready for the voice agent.");
    }
  }, [addBrainStep, budget, dietary, partySize, query, resolveSpokenArea, updateAreaSource, updatePartySize, userText]);

  const flushToolResults = useCallback((socket: WebSocket) => {
    if (socket.readyState !== WebSocket.OPEN || pendingToolResults.current.length === 0) return;
    for (const item of pendingToolResults.current) {
      socket.send(JSON.stringify({ type: "tool.result", call_id: item.call_id, result: JSON.stringify(item.result) }));
    }
    pendingToolResults.current = [];
    setToolStatus("");
  }, []);

  const rejectDecision = useCallback(() => {
    if (!decision) return;
    const nextRejectedIds = [...rejectedIdsRef.current, decision.id];
    rejectedIdsRef.current = nextRejectedIds;
    setRejectedIds(nextRejectedIds);
    setDecision(null);
    setDeliveryOpen(false);
    setRecommendations((items) => items.filter((item) => item.id !== decision.id));
    setRecommendationNote(`Skipped ${decision.name}. Searching for the next best pick.`);
    addBrainStep("Skip", `User skipped ${decision.name}; searching for another option.`);
    void findRecommendations();
  }, [addBrainStep, decision, findRecommendations]);

  const start = useCallback(async () => {
    if (!window.isSecureContext) {
      setError("Microphone access only works on HTTPS or localhost.");
      setStatus("error");
      return;
    }
    setError("");
    setUserText("");
    setAgentText("");
    setStatus("connecting");
    userSpeakingRef.current = false;
    activeReplyEpochRef.current = -1;
    conversationEpochRef.current += 1;
    try {
      const typedArea = areaRef.current.trim();
      if (!typedArea && !locationRef.current && locationStatusRef.current === "idle" && !locationRequestAttemptedRef.current) {
        await withLocationTimeout(requestLocation(), () => setLocationStatus("fallback"), 3500);
      }
      const response = await fetch("/api/voice-token", { cache: "no-store" });
      const payload = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !payload.token) throw new Error(payload.error ?? "Unable to create a voice session.");
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } });
      const audio = new AudioContext();
      context.current = audio;
      await audio.resume();
      await audio.audioWorklet.addModule("/audio/pcm-capture-processor.js");
      const source = audio.createMediaStreamSource(stream.current);
      const processor = new AudioWorkletNode(audio, "pcm-capture", { processorOptions: { inputSampleRate: audio.sampleRate, targetSampleRate: 24000 } });
      worklet.current = processor;
      source.connect(processor);
      playbackTime.current = audio.currentTime;
      const url = new URL("wss://agents.assemblyai.com/v1/ws");
      url.searchParams.set("token", payload.token);
      const socket = new WebSocket(url);
      ws.current = socket;
      processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (ready.current && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "input.audio", audio: toBase64(event.data) }));
      };
      socket.onopen = () => {
        const browserLocationReady = Boolean(locationRef.current);
        const currentArea = areaRef.current.trim();
        const currentPartySizeKnown = partySizeKnownRef.current;
        const locationInstruction = browserLocationReady
          ? `Area is confirmed from browser location${currentArea ? ` as "${currentArea}"` : ""}. Do not ask the user for their location again. If the user asks for food without naming a place, call get_recommendation with the food query and let the app attach the browser coordinates.`
          : currentArea
            ? `Area is confirmed as "${currentArea}". Treat it as the location unless the user changes it. Do not ask for location again unless the user's request needs a different area.`
            : "If no browser location or area is available, ask for the user's area once, briefly.";
        const peopleInstruction = currentPartySizeKnown
          ? `Party size is already confirmed as ${partySize} ${partySize === 1 ? "person" : "people"}. Do not ask how many people again.`
          : "Party size is not confirmed yet. The visible value 2 is only a default placeholder, so ask whether it is for the user alone or how many people if the user has not said it.";
        const budgetInstruction = `Budget is currently set to ${budget}. You may use it unless the user changes it.`;
        const contextInstruction = `${locationInstruction} ${peopleInstruction} ${budgetInstruction}`;
        const greeting = currentArea || browserLocationReady
          ? currentPartySizeKnown
            ? "Got it. What are you craving?"
            : "Got the area. What are you craving, and how many people?"
          : "What are you craving, and which area should I search?";
        const session = createInlineVoiceSession(contextInstruction, greeting);
        socket.send(JSON.stringify({ type: "session.update", session }));
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as AgentEvent;
        if (message.type === "session.ready") {
          ready.current = true;
          setStatus("listening");
        } else if (message.type === "input.speech.started") {
          userSpeakingRef.current = true;
          conversationEpochRef.current += 1;
          activeReplyEpochRef.current = -1;
          clearPlayback();
          setStatus("listening");
        } else if (message.type === "input.speech.ended") {
          userSpeakingRef.current = false;
          setStatus("listening");
        } else if (message.type === "reply.started") {
          if (!userSpeakingRef.current) {
            activeReplyEpochRef.current = conversationEpochRef.current;
            setStatus("speaking");
          }
        } else if (message.type === "reply.audio" && message.data) {
          if (!userSpeakingRef.current) play(message.data);
        }
        else if (message.type === "transcript.user" && message.text) {
          userSpeakingRef.current = false;
          setUserText(message.text);
          setQuery(message.text);
          applyTranscriptHints(message.text);
          addBrainStep("Heard user", message.text);
        } else if (message.type === "transcript.agent" && message.text) setAgentText(message.text);
        else if (message.type === "tool.call") void runRecommendationTool(message);
        else if (message.type === "reply.done") {
          flushToolResults(socket);
          setStatus("listening");
        } else if (message.type === "session.error" || message.type === "error") {
          setError(message.message ?? "Voice service error.");
          setStatus("error");
        }
      };
      socket.onerror = () => {
        setError("Unable to connect to the voice service. Check network and API key.");
        setStatus("error");
      };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start voice session.");
      setStatus("error");
      stream.current?.getTracks().forEach((track) => track.stop());
      void context.current?.close();
    }
  }, [addBrainStep, applyTranscriptHints, budget, clearPlayback, flushToolResults, partySize, play, requestLocation, runRecommendationTool]);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    locationRef.current = location;
    if (location) {
      locationStatusRef.current = "ready";
    }
  }, [location]);
  useEffect(() => {
    areaRef.current = area;
  }, [area]);
  useEffect(() => {
    locationStatusRef.current = locationStatus;
  }, [locationStatus]);
  useEffect(() => {
    rejectedIdsRef.current = rejectedIds;
  }, [rejectedIds]);

  const voiceActive = status === "connecting" || status === "listening" || status === "speaking";
  const orbClass = `mic-elevation ${voiceActive ? "mic-elevation-active" : ""} ${status === "listening" ? "mic-elevation-listening" : ""} ${status === "speaking" ? "mic-elevation-speaking" : ""}`;
  const typedArea = area.trim();
  const isBrowserArea = areaSource === "browser";
  const routeOrigin = isBrowserArea && location ? `${location.latitude},${location.longitude}` : typedArea || (location ? `${location.latitude},${location.longitude}` : areaUsed || undefined);
  const locationMessage = typedArea
    ? isBrowserArea
      ? `Using browser location: ${typedArea}.`
      : `Using typed area: ${typedArea}.`
    : locationStatus === "ready"
      ? "Using your browser location."
      : locationStatus === "asking"
        ? "Please allow location permission for nearby picks."
        : locationStatus === "fallback"
          ? "Location permission was not available. Type an Area or say your location."
          : "Choose manual Area, browser location, or voice input.";
  const deliveryLinks = decision ? deliverySearchLinks(decision, typedArea || areaUsed) : [];

  return (
    <main className="liquid-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <section className="liquid-stage">
        <div className="brand-row">
          <div>
            <p className="eyebrow">AssemblyAI Hackathon</p>
            <h1>DecideEats</h1>
          </div>
          <div className="status-pill">{recommendationMode === "live" ? "Live places" : "Demo ready"}</div>
        </div>

        <div className="hero-grid">
          <section className="glass-panel voice-panel">
            <p className="voice-caption">Voice decision agent</p>
            <p className="voice-state">{statusLabel(status)}</p>

            <div className="mic-scene">
              <button
                type="button"
                onClick={status === "idle" || status === "error" ? start : stop}
                disabled={status === "connecting"}
                className={orbClass}
                aria-label={status === "idle" || status === "error" ? "Start voice conversation" : "Stop voice conversation"}
                title={status === "idle" || status === "error" ? "Start voice conversation" : "Stop voice conversation"}
              >
                <span className="mic-plane">
                  <span className="mic-shadow" />
                  <span className="mic-plane-shine" />
                </span>
                <span className="mic-aura" />
                <span className="mic-sphere">
                  {status === "connecting" ? <Sparkles /> : <Mic className={voiceActive ? "active-mic-icon" : ""} />}
                </span>
              </button>
            </div>

            <p className="orb-label">{voiceActive ? "Tap to stop" : "Tap to speak"}</p>

            <div className="transcript-stack">
              {userText && (
                <div className="glass-bubble">
                  <span>You</span>
                  <p>{userText}</p>
                </div>
              )}
              {agentText && (
                <div className="glass-bubble agent-bubble">
                  <span>DecideEats</span>
                  <p>{agentText}</p>
                </div>
              )}
              {error && (
                <div className="error-bubble" role="alert">
                  {error}
                </div>
              )}
            </div>
          </section>

          <section className="glass-panel decision-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Decision Board</p>
                <h2>One place, not ten tabs.</h2>
              </div>
              <button type="button" onClick={() => void requestLocation(true)} className="icon-glass-button" title="Use browser location" aria-label="Use browser location">
                <LocateFixed />
              </button>
            </div>

            <div className="search-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="pizza, ramen, halal dinner..." />
              <button type="button" onClick={() => void findRecommendations()} disabled={isSearching}>
                <Search />
                {isSearching ? "Finding" : "Find"}
              </button>
            </div>

            <div className="preference-grid">
              <div className="budget-control">
                <span>Budget</span>
                <div className="segmented-control" role="radiogroup" aria-label="Budget">
                  <span className={`segment-thumb segment-${budget}`} />
                  {budgetOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={budget === option.value}
                      className={budget === option.value ? "selected" : ""}
                      onClick={() => setBudget(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span>People</span>
                <input type="number" min={1} max={12} value={partySize} onChange={(event) => updatePartySize(Number(event.target.value) || 1)} />
              </label>
              <label>
                <span>Dietary</span>
                <input value={dietary} onChange={(event) => setDietary(event.target.value)} placeholder="halal, vegan..." />
              </label>
              <label className="area-field">
                <span>Area</span>
                <input
                  value={area}
                  onChange={(event) => {
                    updateAreaSource(event.target.value.trim() ? "manual" : "empty");
                    setArea(event.target.value);
                    areaRef.current = event.target.value;
                    setLocationStatus("idle");
                  }}
                  placeholder="Miri, Kota Kinabalu, Kulai..."
                />
              </label>
            </div>

            <p className="location-line">{locationMessage}</p>

            <section className={`brain-panel ${brainOpen ? "brain-panel-open" : ""}`}>
              <button type="button" onClick={() => setBrainOpen((open) => !open)} aria-expanded={brainOpen}>
                <span>
                  <Brain />
                  Agent brain
                </span>
                <ChevronDown />
              </button>
              <div className="brain-steps">
                {brainSteps.map((step) => (
                  <div key={step.id}>
                    <strong>{step.label}</strong>
                    <span>{step.detail}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="results-stack">
              {recommendations.length === 0 ? (
                <div className="empty-state">Speak or type a craving. DecideEats will choose one nearby pick and explain why.</div>
              ) : (
                <>
                  {decision && (
                    <article className="decision-card">
                      <div>
                        <p>Tonight&apos;s pick</p>
                        <h3>{decision.name}</h3>
                        <span>{decision.category} · {priceLabel(decision)} · {budgetLabel(decision)}</span>
                        <small>{decision.address}</small>
                        <strong>{decision.reason}</strong>
                      </div>
                      <div className="decision-actions">
                        <a href={directionsUrl(decision, routeOrigin)} target="_blank" rel="noreferrer" className="map-button" title="Open directions in Google Maps" aria-label="Open directions in Google Maps">
                          <MapPinned />
                          Directions
                        </a>
                        <div className={`delivery-menu ${deliveryOpen ? "delivery-menu-open" : ""}`}>
                          <button type="button" onClick={() => setDeliveryOpen((open) => !open)} aria-expanded={deliveryOpen}>
                            <ShoppingBag />
                            Delivery
                            <ChevronDown />
                          </button>
                          <div>
                            {deliveryLinks.map((link) => (
                              <a key={link.label} href={link.url} target="_blank" rel="noreferrer">
                                {link.label}
                                <ExternalLink />
                              </a>
                            ))}
                          </div>
                        </div>
                        <button type="button" onClick={rejectDecision} className="skip-button" title="Skip this pick" aria-label="Skip this pick">
                          <ThumbsDown />
                        </button>
                      </div>
                    </article>
                  )}

                  {recommendations.map((item, index) => (
                    <article key={item.id} className={`place-card ${expandedPlaceId === item.id ? "place-card-expanded" : ""}`}>
                      <div>
                        <p>Pick {index + 1}</p>
                        <h3>{item.name}</h3>
                        <span>{item.category} · {priceLabel(item)} · {budgetLabel(item)}</span>
                        <small>{item.address}</small>
                        <button
                          type="button"
                          className="why-button"
                          aria-expanded={expandedPlaceId === item.id}
                          onClick={() => setExpandedPlaceId((current) => (current === item.id ? null : item.id))}
                        >
                          Why this?
                          <ChevronDown />
                        </button>
                        <strong className="place-reason">{item.reason}</strong>
                      </div>
                      <a href={directionsUrl(item, routeOrigin)} target="_blank" rel="noreferrer" className="mini-map-button" title="Open directions in Google Maps" aria-label={`Open directions to ${item.name}`}>
                        <MapPinned />
                      </a>
                    </article>
                  ))}
                </>
              )}
            </div>

            {(recommendationNote || recommendationError || toolStatus) && (
              <p className={recommendationError ? "note-line error-note" : "note-line"}>{recommendationError || toolStatus || recommendationNote}</p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
