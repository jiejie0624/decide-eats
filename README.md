# DecideEats

Voice-first restaurant decision agent for the AssemblyAI Voice Agent Hackathon.

## Current status

Implemented:

- Browser microphone capture with AssemblyAI temporary-token authentication.
- Direct AssemblyAI Voice Agent WebSocket connection.
- Live transcript display and PCM audio playback.
- Interruption cleanup when the user speaks or stops the session.
- Restaurant recommendation panel with browser geolocation.
- Server-only `/api/recommendation` endpoint for Foursquare Places API.
- Marked demo fallback when Foursquare is not configured or unavailable.
- AssemblyAI `get_recommendation` function tool registration.
- Client-side `tool.call` handling that calls `/api/recommendation` and sends `tool.result` after `reply.done`.
- Temporary client preference state for budget, party size, dietary notes, and rejected restaurant IDs.
- One highlighted final pick with a skip action that excludes the rejected restaurant from the next result.
- Lightweight per-IP rate limiting for voice-token and recommendation endpoints.
- Hackathon submission draft in the project outputs folder.

Still pending:

- Production deployment from your hosting account.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `ASSEMBLYAI_API_KEY` to a valid AssemblyAI API key. Do not expose it with a `NEXT_PUBLIC_` prefix.
3. Optional: set `FOURSQUARE_API_KEY` for live nearby restaurant results. Without it, the app returns clearly marked demo results.
4. Run `npm run dev`.
5. Open `http://localhost:3000`, click the voice button, allow microphone access, then speak.

The app works without `NEXT_PUBLIC_ASSEMBLYAI_AGENT_ID` by using an inline hackathon prompt. A stored agent ID is optional and replaces the inline configuration.

## Architecture

```text
Browser microphone -> AudioWorklet resamples to PCM16 / 24 kHz
                   -> AssemblyAI Voice Agent WebSocket
Browser <- temporary token <- Next.js /api/voice-token <- AssemblyAI key

Browser recommendation panel -> Next.js /api/recommendation
                              -> Foursquare Places API when configured
                              -> marked demo fallback otherwise
```

Permanent API keys are read only by server routes. The browser receives a short-lived AssemblyAI token and never receives third-party provider secrets.

## Verification

Run:

```bash
npm run lint
npm run build
```

Current local verification passes, including an AssemblyAI `session.ready` smoke test with the recommendation tool schema registered and a live Foursquare rejection-exclusion smoke test.

## Deployment

Deploy as a normal Next.js app and configure these server environment variables in your host:

- `ASSEMBLYAI_API_KEY`
- `FOURSQUARE_API_KEY`
- `FOURSQUARE_API_VERSION`

Do not prefix API keys with `NEXT_PUBLIC_`.
