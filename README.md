# Family Convoy Navigator

[![iOS Production](https://github.com/geoffreyatta1/convoy-/actions/workflows/eas-build.yml/badge.svg?branch=main&event=push)](https://github.com/geoffreyatta1/convoy-/actions/workflows/eas-build.yml?query=branch%3Amain+job%3Abuild-ios-production)
[![Android Production](https://github.com/geoffreyatta1/convoy-/actions/workflows/eas-build.yml/badge.svg?branch=main&event=push)](https://github.com/geoffreyatta1/convoy-/actions/workflows/eas-build.yml?query=branch%3Amain+job%3Abuild-android-production)

A real-time convoy coordination app built with Expo (React Native) and a Node.js API server. Drivers in a convoy share live GPS positions, communicate via push-to-talk voice channels, and coordinate stops — all without requiring each person to be on the phone.

## Monorepo Layout

```
artifacts/
  mobile/          # Expo React Native app (iOS + Android)
  api-server/      # Node.js/Express API and WebSocket server
  mockup-sandbox/  # UI component preview / design canvas
lib/
  api-client-react/  # Generated React Query hooks from OpenAPI spec
  api-spec/          # OpenAPI contract + codegen config
  db/                # Drizzle ORM schema and migrations
scripts/             # Shared utility scripts
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22+ |
| pnpm | 9+ |
| Expo account | [expo.dev](https://expo.dev) |
| EAS CLI | `npm install -g eas-cli` |

## Clone and Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/geoffreyatta1/convoy-.git
cd convoy-

# 2. Install all workspace dependencies
pnpm install

# 3. Copy environment variables and fill in your values
#    (see Environment Variables section below)

# 4. Start the API server
pnpm --filter @workspace/api-server run dev

# 5. Start the Expo development server (in a separate terminal)
cd artifacts/mobile
pnpm dev
```

Scan the QR code printed by Expo with the **Expo Go** app on your device, or press `i` to open an iOS simulator.

## Environment Variables

Create a `.env` file (or set these in your shell / Replit Secrets) before running locally:

| Variable | Description |
|----------|-------------|
| `AGORA_APP_ID` | Agora project App ID for push-to-talk voice channels |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key |
| `DATABASE_URL` | PostgreSQL connection string for the API server |

## GitHub Actions — EAS CI

The workflow at `.github/workflows/eas-build.yml` runs four build jobs automatically — iOS and Android run in parallel for each trigger:

| Trigger | Job | Platform | EAS Profile | Distribution |
|---------|-----|----------|-------------|--------------|
| Push to `main` | `build-ios-production` | iOS | `production` | App Store / TestFlight |
| Push to `main` | `build-android-production` | Android | `production` | Play Store (AAB) |
| Push to `develop` or any PR to `main` | `build-ios-preview` | iOS | `preview` | Internal (ad-hoc) |
| Push to `develop` or any PR to `main` | `build-android-preview` | Android | `preview` | Internal (APK) |

### Required GitHub Repository Secrets

Add these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | EAS personal access token ([generate here](https://expo.dev/accounts/[account]/settings/access-tokens)) |

### Optional secrets (passed through to build if needed)

| Secret | Description |
|--------|-------------|
| `AGORA_APP_ID` | Agora App ID |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |

## Installing Preview Builds (Testers)

Preview builds are signed for ad-hoc distribution, so they install directly on registered test devices without going through the App Store or TestFlight.

### One-time device registration

Before you can install a preview build, your device must be registered in the Apple Developer account:

```bash
cd artifacts/mobile
eas device:create
```

Scan the QR code that appears and follow the on-screen instructions on your iPhone. You only need to do this once per device.

> **Note:** Preview builds only run automatically for PRs opened from branches within this repository. PRs from forks will skip the preview job because GitHub does not expose repository secrets to untrusted forks.

### Getting the build

1. When a preview build finishes (after a push to `develop` or a PR to `main`), open the [EAS dashboard](https://expo.dev) and navigate to your project's **Builds** page.
2. Find the build with profile **preview** and click **Install**.
3. Scan the QR code with your iPhone camera, or tap the install link — iOS will prompt you to install the app.

### Building a preview build locally

```bash
cd artifacts/mobile
eas build --platform ios --profile preview
```

After the build completes, EAS prints an install link and QR code you can share with testers directly.

## Connecting Your GitHub Remote

The repository at `https://github.com/geoffreyatta1/convoy-` already exists. Add it as the `origin` remote and push:

```bash
git remote add origin https://github.com/geoffreyatta1/convoy-.git
git push -u origin main
```

> **Note:** Any push that adds or modifies files inside `.github/workflows/` requires a [Personal Access Token (classic)](https://github.com/settings/tokens/new) with both the `repo` **and** `workflow` scopes checked. GitHub enforces this for all operations on workflow files — including the initial push and any future edits to the CI configuration.

## Building for Production (locally)

```bash
# Log in to EAS
eas login

# Build iOS
cd artifacts/mobile
eas build --platform ios --profile production

# Build Android
eas build --platform android --profile production
```

## Contributing

All changes to `main` must go through a pull request — direct pushes are blocked by branch protection.

### Workflow

1. **Branch off `develop`** (or a feature branch) — never work directly on `main`.
   ```bash
   git checkout develop
   git pull
   git checkout -b feat/my-feature
   ```

2. **Open a pull request** targeting `main` when your work is ready.

3. **Wait for CI to pass** — the *Type Check* workflow (`pnpm run typecheck`) runs automatically on every PR. The EAS preview builds also run and produce installable iOS/Android builds for review.

4. **Get at least one approved review** — a reviewer from `@geoffreyatta1` must approve before the PR can be merged.

5. **Merge** — squash or merge commit, your choice. Delete the branch after merging.

### Branch protection rules (enforced by GitHub)

| Rule | Setting |
|------|---------|
| Required approvals | 1 |
| Required status checks | `Type Check` (CI typecheck) |
| Require branch up to date | Yes |
| Block direct pushes | Yes |
| Block force pushes | Yes |

> These rules are configured via the GitHub branch protection API and apply to all contributors, including repository owners.

### Setting up or re-applying branch protection

A reproducible setup script lives at `scripts/src/setup-branch-protection.ts`.

**Apply rules** (e.g. on a fresh fork or after accidental removal):
```bash
GITHUB_TOKEN=<pat-with-repo-scope> pnpm --filter @workspace/scripts run setup-branch-protection
```

**Verify the current state**:
```bash
GITHUB_TOKEN=<pat-with-repo-scope> pnpm --filter @workspace/scripts run verify-branch-protection
```

The verify command prints a ✓ / ✗ checklist for every rule. Use it to confirm the protection is active after running the setup, or to audit it at any time.

### PR template

A PR description template lives at `.github/pull_request_template.md` and auto-fills when you open a PR on GitHub.

### Code ownership

`.github/CODEOWNERS` assigns `@geoffreyatta1` as the default reviewer for all files so GitHub automatically requests a review on every PR.

## Tech Stack

- **Mobile**: Expo SDK 54, React Native, Expo Router, React Query
- **Voice**: Agora RTC (push-to-talk)
- **Backend**: Node.js, Express, Drizzle ORM, PostgreSQL
- **Real-time**: Supabase (presence, convoy state)
- **Maps**: React Native Maps
- **CI/CD**: EAS Build + GitHub Actions
