# DecideEats

Voice-first restaurant decisions powered by AssemblyAI.

[Live demo](https://decide-eats.vercel.app/) · [GitHub repo](https://github.com/jiejie0624/decide-eats)

## Overview

DecideEats helps people choose where to eat without opening ten tabs or scrolling through endless restaurant lists.

Users can speak naturally:

> “I live in Miri, Sarawak. I want nasi lemak for four people.”

The app listens, extracts the important context, updates the visible form, searches nearby restaurants, estimates the price range, and returns one clear pick with Google Maps directions.

Built for the [AssemblyAI Voice Agent Hackathon](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon) by lablab.ai.

## Why it matters

Choosing a restaurant is rarely a clean search query. People mention cravings, location, budget, group size, and dietary needs in one messy sentence.

DecideEats turns that conversation into a decision:

- One recommended restaurant, not a long list
- Location-aware search using browser permission or spoken area
- Visible fields that stay editable after voice input
- Estimated RM price ranges and budget fit
- Directions that open directly in Google Maps

## Features

| Area | What DecideEats does |
|---|---|
| Voice input | Starts an AssemblyAI Voice Agent session from the browser |
| Permission flow | Requests location permission when the user taps the microphone |
| Form sync | Updates Area, People, Budget, and Dietary fields from speech |
| Restaurant search | Uses Foursquare Places for live nearby restaurant candidates |
| Price guidance | Shows estimated RM price ranges when provider pricing is missing |
| Decision flow | Highlights one pick and supports skipping to the next option |
| Navigation | Opens Google Maps Directions with the resolved origin and destination |

## Demo flow

1. Open the live demo.
2. Tap the microphone.
3. Allow location and microphone access.
4. Say: “I live in Miri, Sarawak. I want nasi lemak for four people.”
5. DecideEats updates the form and recommends one restaurant.
6. Tap Directions to open the route in Google Maps.

## Tech stack

- **Frontend:** Next.js, React, TypeScript, CSS
- **Voice AI:** AssemblyAI Voice Agent
- **Places data:** Foursquare Places API
- **Directions:** Google Maps Directions links
- **Deployment:** Vercel

## Architecture

```text
User voice
  -> Browser microphone
  -> AudioWorklet PCM capture
  -> AssemblyAI Voice Agent WebSocket
  -> get_recommendation tool call
  -> Next.js /api/recommendation
  -> Foursquare Places API
  -> Ranked restaurant result
  -> UI update + spoken response
  -> Google Maps Directions
```

Server-only API keys stay in backend routes. The browser receives a short-lived AssemblyAI token and never receives permanent provider secrets.

## Local development

Clone the project and install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your own keys:

```bash
ASSEMBLYAI_API_KEY=your_assemblyai_key
FOURSQUARE_API_KEY=your_foursquare_key
FOURSQUARE_API_VERSION=2025-06-17
DEFAULT_SEARCH_LATITUDE=1.519901
DEFAULT_SEARCH_LONGITUDE=103.6586369
DEFAULT_SEARCH_LABEL=Taman Ungku Tun Aminah
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `ASSEMBLYAI_API_KEY` | Yes | Creates temporary voice session tokens |
| `FOURSQUARE_API_KEY` | Yes for live data | Searches live restaurant places |
| `FOURSQUARE_API_VERSION` | Recommended | Pins the Foursquare Places API version |
| `DEFAULT_SEARCH_LATITUDE` | Optional | Fallback search latitude |
| `DEFAULT_SEARCH_LONGITUDE` | Optional | Fallback search longitude |
| `DEFAULT_SEARCH_LABEL` | Optional | Fallback search label |
| `NEXT_PUBLIC_ASSEMBLYAI_AGENT_ID` | Optional | Uses a stored AssemblyAI agent instead of the inline session config |

Do not prefix secret API keys with `NEXT_PUBLIC_`.

## Deployment

The app deploys as a standard Next.js project on Vercel.

1. Import the GitHub repository into Vercel.
2. Add the environment variables listed above.
3. Deploy the `master` branch.
4. Test the live URL with microphone and location permission enabled.

When environment variables change, redeploy the latest deployment so the server routes receive the new values.

## Verification

Run these checks before submitting:

```bash
npm run lint
npm run build
```

## Hackathon submission checklist

- [x] Uses AssemblyAI Voice Agent
- [x] Working web prototype
- [x] GitHub repository
- [x] Vercel deployment
- [x] Live restaurant search
- [x] Google Maps directions
- [x] Pitch deck
- [ ] Demo video
- [ ] Final lablab.ai submission

## Project status

DecideEats is a working hackathon prototype. The current version focuses on a fast voice-driven decision loop: speak, resolve location and constraints, choose one restaurant, and open directions.

Future improvements could add stronger price confidence, saved user preferences, group voting, opening-hours filtering, and mobile PWA polish.
