# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Family Convoy Navigator (artifacts/mobile)

Expo SDK 54 mobile app (expo-router v6, React 19, RN 0.81) with orange (#f59e0b) accent theme that automatically follows the system light/dark mode.

### Tab Structure (4 tabs)
- **Convoy** (`convoy.tsx`) — Walkie-talkie push-to-talk screen with animated PTT button
- **Map** (`map.tsx`) — Apple Maps-style layout: floating convoy pill (top-left), right sidebar buttons (2D/radio/share/navigate/exit), green Navigate button, draggable bottom sheet with stats bar during navigation
- **Convoys** (`convoys.tsx`) — Active convoy card + Create/Join modals + Convoy History
- **Settings** (`settings.tsx`) — Navigation prefs, Preferences, Privacy, Coming Soon, Developer Tools (freemium tier picker), Account

### Freemium Tiers
- **Free** — Up to 3 vehicles per convoy
- **Convenience** ($2.99/mo) — Up to 9 vehicles
- **Roadtrip** ($5.99/mo) — Unlimited vehicles + priority support
- Tier state persisted via AsyncStorage; Developer Tools in Settings lets you switch tiers for testing
- `SubscriptionContext` exported from `context/SubscriptionContext.tsx`

### Auth & Backend
- **Supabase** is the auth and database backend
- Mobile: `lib/supabase.ts` creates the Supabase client using `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (injected from `SUPABASE_URL` / `SUPABASE_ANON_KEY` secrets by the dev workflow script)
- `context/AuthContext.tsx` — `AuthProvider` wraps the app; `useAuth()` exposes `session`, `user`, `isLoading`, `signOut`, `getAccessToken`
- `app/(auth)/sign-in.tsx` + `sign-up.tsx` — Supabase email/password auth screens; redirected to from `app/index.tsx` when no session
- API server: `src/lib/supabase.ts` — admin client using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; `src/middlewares/requireAuth.ts` validates Bearer JWT from Supabase
- Agora token endpoint (`/api/agora-token`) requires a valid Supabase Bearer token; `setAuthTokenGetter` in `services/agora.native.ts` wires this up via `AgoraAuthWiring` in `_layout.tsx`
- Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `GOOGLE_API_KEY`

### Features
- **Convoy creation/join** with 6-char codes; persisted via AsyncStorage
- **Hazard reporting** — any driver (in or out of a convoy) can report Police, Accident, Construction, Debris, or Other hazards; stored in PostgreSQL, broadcast to all connected WebSocket clients globally, visible on every driver's map; expire after 2 hours; tap to see callout with type/reporter/time. Shield button in map sidebar opens picker sheet.
- **Live map** (react-native-maps 1.18.0 pinned — DO NOT update) with car markers, polyline formation, destination pin; uses `PROVIDER_GOOGLE` (Google Maps renderer on Android; iOS requires custom EAS build with Google Maps SDK)
- **Synced turn-by-turn navigation** — leader searches via Google Places Text Search API, route via Google Directions API (encoded polyline decoded client-side), NavPanel syncs current step to all convoy members; GPS auto-advance on native, timer-based on web/sim
- **ETA stats bar** — Shows arrival time / hrs / distance remaining when navigating, with orange Share ETA button
- **Share invite** — native Share sheet with `convoy://join/<CODE>` deep link + copy-to-clipboard
- **Destination picker** — address search modal with route stats (distance, ETA, step count)
- **Push-to-talk** with animated pulse ring; 10 s auto-release; on Convoy tab
- **Convoy formation** — horizontal scroll strip showing vehicle positions (toggleable on Map tab)
- **MergePill** — minimal "In sync in X min" pill for followers joining convoy route
- **CarPlay** (iOS, dev build required) via react-native-carplay + withCarPlay plugin
- **Android Auto** (dev build required) via NativeModules bridge + withAndroidAuto plugin
- **URL schemes**: `mobile://` and `convoy://`

### Key Files
- `context/ConvoyContext.tsx` — all convoy + navigation + hazard state
- `services/hazards.ts` — `fetchHazards(lat, lng)` and `reportHazard()` API calls
- `components/HazardPicker.tsx` — bottom sheet modal for picking hazard type
- `context/SubscriptionContext.tsx` — freemium tier management (Free/Convenience/Roadtrip)
- `services/routing.ts` — OSRM routing, Nominatim geocoding, haversine, formatters
- `components/NavPanel.tsx` — turn-by-turn overlay
- `components/MergePill.tsx` — sync pill for followers
- `components/DestinationPicker.tsx` — address search + route fetch modal
- `components/ShareConvoyModal.tsx` — share sheet + copy code
- `components/ConvoyMap.native.tsx` / `.web.tsx` — platform-split map
- `services/carplay.native.ts` / `.ts` — platform-split CarPlay
- `services/androidauto.native.ts` / `.ts` — platform-split Android Auto
- `constants/colors.ts` — orange/black design tokens; primary = #f59e0b

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
