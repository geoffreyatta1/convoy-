# Building & Shipping Family Convoy Navigator for iOS

A step-by-step guide from first build to App Store.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Node 20+ | Already available in Replit |
| EAS CLI | `npm install -g eas-cli` |
| Xcode 16+ | Download from Mac App Store |
| Apple Developer account | https://developer.apple.com/account |

---

## 1. One-time setup

### 1a. Replace the two placeholders in `app.json`

```jsonc
"owner": "YOUR_EXPO_ACCOUNT_SLUG",   // ← your Expo username (expo.dev account)
"projectId": "YOUR_EAS_PROJECT_ID"   // ← filled automatically by `eas init`
```

### 1b. Log in and initialise EAS

```bash
cd artifacts/mobile
eas login              # log in with your Expo account
eas init               # links this project, fills in projectId automatically
```

---

## 2a. Development build — iOS Simulator (fastest, test CarPlay)

The quickest way to test native modules including CarPlay. No physical device needed.

```bash
eas build --platform ios --profile development-simulator
```

Once the build finishes (~10 min on EAS cloud):

1. Download the `.app` file from the EAS dashboard.
2. Open Xcode → open a Simulator (iPhone 16 Pro). Drag the `.app` file onto the Simulator window to install.
3. Launch the app in Simulator.
4. In the Simulator menu bar: **Features → CarPlay** — a second CarPlay window opens.
5. Join a convoy and start navigation to see the CarPlay maneuver panel update live.

> **CarPlay Simulator does NOT require the navigation entitlement.** You can test the full UI before Apple approves your application.

---

## 2b. Development build — real iPhone (test real CarPlay hardware)

Use this profile to install a dev-client on a physical iPhone for testing with a real CarPlay head unit or a Lightning → HDMI CarPlay receiver.

```bash
# Register the device first (run once per iPhone)
eas device:create

# Build for real iPhones
eas build --platform ios --profile development
```

Once built:

1. Open the install link from the EAS dashboard on the target iPhone.
2. Tap **Install** when prompted.
3. Go to **Settings → General → VPN & Device Management** and trust the developer certificate.
4. Connect the iPhone to a CarPlay-enabled car or adapter and launch the app.

---

## 3. Preview build (real iPhone, no TestFlight)

Install on registered test iPhones without going through App Store review.

```bash
# Register a device first (run on a Mac with the iPhone connected)
eas device:create

# Build for real devices
eas build --platform ios --profile preview
```

Share the install link from the EAS dashboard. Testers tap the link on their iPhone to install.

---

## 4. Requesting the CarPlay navigation entitlement ⭐

**Do this before your production build.** Without it, App Store review will reject the app.

1. Go to: https://developer.apple.com/contact/request/carplay/
2. Select **Navigation** as the app type.
3. Fill in:
   - **App name:** Family Convoy Navigator
   - **Bundle ID:** com.convoy.app
   - **Description:** _"A navigation app for coordinating groups of vehicles driving to a shared destination. Each vehicle receives turn-by-turn directions synced to the convoy route. The CarPlay interface shows the current maneuver and distance, a live list of convoy members with speeds, and push-to-talk communication — all without touching the phone."_
   - **CarPlay templates used:** MapTemplate, ListTemplate, AlertTemplate, GridTemplate, CPNavigationSession with CPManeuver
   - **Mapping SDK:** react-native-maps (MapKit on iOS) + OSRM for routing
4. Attach the four screenshots from `app-store-metadata/carplay-screenshots/` (if generated).
5. **Mention your existing Communications entitlement** — Apple will see you're already an approved CarPlay developer, which significantly speeds up approval.

Approval typically takes 5–15 business days.

---

## 5. Required environment variables

Set these via `eas secret:create --name KEY --value value` or in your `.env.local` (never commit secrets):

| Variable | Where to find it |
|---|---|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_TEAM_ID` | developer.apple.com/account → Membership → Team ID (10 chars) |
| `ASC_API_KEY_ID` | App Store Connect → Users & Access → Integrations → Keys → Key ID |
| `ASC_API_KEY_ISSUER_ID` | Same page — Issuer ID |
| `ASC_API_KEY_PATH` | Path to the downloaded `.p8` file |
| `SUPABASE_URL` | Already in Replit secrets |
| `SUPABASE_ANON_KEY` | Already in Replit secrets |
| `AGORA_APP_ID` | Already in Replit secrets (set as `EXPO_PUBLIC_AGORA_APP_ID` in dev) |

---

## 6. Production build + TestFlight

```bash
# Build
eas build --platform ios --profile production

# Submit to App Store Connect (TestFlight)
eas submit --platform ios --profile production
```

The `eas submit` command uploads the `.ipa` to TestFlight automatically using your ASC API key.

---

## 7. App Store Connect setup (manual steps)

In App Store Connect (https://appstoreconnect.apple.com):

1. Create a new app with bundle ID `com.convoy.app`.
2. Set the **Category:** Navigation.
3. Copy content from `app-store-metadata/en-US/`:
   - **Name:** `name.txt`
   - **Subtitle:** `subtitle.txt`
   - **Description:** `description.txt`
   - **Keywords:** `keywords.txt` (comma-separated, max 100 chars)
   - **What's New:** `release_notes.txt`
4. Upload screenshots (see App Store screenshot sizes below).
5. Set **Age Rating** to 4+.
6. Add the **Privacy Policy URL** (required — host a simple one on your domain).
7. Under **App Information → CarPlay:** confirm CarPlay is listed. It will be automatically detected from the entitlement.

### Screenshot sizes required

| Device | Size |
|---|---|
| iPhone 16 Pro Max | 1320×2868 px |
| iPhone 8 Plus | 1242×2208 px |
| iPad Pro 13" (M4) | 2064×2752 px |

Minimum: iPhone 16 Pro Max + iPhone 8 Plus. iPad is optional if `supportsTablet: false`.

---

## 8. Checklist before submitting for App Store review

- [ ] CarPlay navigation entitlement approved by Apple
- [ ] All four CarPlay screenshots attached to the form
- [ ] Privacy Policy URL set in App Store Connect
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AGORA_APP_ID` set as EAS production secrets
- [ ] Stripe is in live mode (not test mode) with real price IDs
- [ ] App tested on a real iPhone (preview build)
- [ ] CarPlay tested in Xcode Simulator (development build)
- [ ] TestFlight beta tested with at least one external tester

---

## Common issues

**`The entitlement com.apple.developer.carplay-navigation is not permitted`**
→ You haven't received Apple's approval yet. Submit the request form and wait.

**`No provisioning profile found`**
→ Run `eas credentials` to let EAS set up your certificates and profiles automatically.

**`Metro bundler can't find module X`**
→ Run `pnpm install` from `artifacts/mobile`, then restart the Metro bundler.

**CarPlay window is blank in Simulator**
→ Ensure you installed the development build (not Expo Go). Open Simulator → Features → CarPlay.
