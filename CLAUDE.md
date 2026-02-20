# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WrapBattz is a React Native application for enterprise device management using NFC technology. Organizations can track, assign, and manage devices across multiple locations with role-based access control (owner, admin, office_worker, site_worker).

## Development Commands

```bash
npm start                  # Start Expo development server
npm run android            # Run on Android (expo run:android)
npm run ios                # Run on iOS (expo run:ios)
npm run web                # Run in web browser
expo start -c              # Start with cleared Metro cache

npm test                   # Run unit tests (Jest)
npm test -- path/to/test   # Run single test file
npm test -- -t "pattern"   # Run tests matching pattern
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
npm run test:ci            # CI mode (no watch)
npm run test:e2e           # E2E tests (Detox)

# EAS builds
eas build --platform android --profile development
eas build --platform ios --profile development
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Architecture

### Tech Stack
- React Native 0.81.5 with Expo SDK 54
- Mixed JavaScript/TypeScript codebase (gradual TS adoption, `strict: false`)
- React Navigation v7 (stack + bottom tabs)
- REST API backend at `webportal.battwrapz.com/api`
- Axios for HTTP (two instances: token-auth + API-key-auth)
- SQLite for optional offline storage
- Stripe for payments, Sentry for error tracking
- Path alias: `@/` maps to `src/` (configured in tsconfig + Jest)

### API Layer — Two Authentication Patterns

**AuthContext.js** is the central hub. It creates two Axios instances:
1. **`axiosInstance`** — Token-based auth (JWT access + refresh tokens in AsyncStorage). Has interceptors for auto-attaching tokens and global 401 handling with session expiry alerts.
2. **`mobileApiInstance`** — API-key auth (key stored in SecureStore). Used for mobile-specific features like feature suggestions.

AuthContext exposes `deviceService` and `mobileService` objects with methods for all API operations. Most screens consume these via `useAuth()`.

**`src/services/api.js`** is a legacy Axios wrapper with its own interceptors — being phased out but still used in some screens and hooks.

### State Management
- **AuthContext** (`src/context/AuthContext.js`) — Auth state, user data, role checks (`isAdmin`, `isOwner`, `isAdminOrOwner`), API services, session monitoring (30-second interval + AppState listener), BillingService singleton
- **SQLiteContext** (`src/context/SQLiteContext.js`) — Optional offline-first storage with local CRUD and sync. Tables: locations, devices, device_assignments, device_returns, reports

### Navigation Flow
```
AuthStack → OnboardingStack → MainStack
  (Login, Register,       (CreateOrganization    (TabNavigation + detail/modal screens)
   ForgotPassword,         if no orgId)
   Pricing, SuggestFeature)

TabNavigation: Dashboard | Reports | Locations (admin/owner only) | Profile | Logout
```
Defined in `src/navigation/index.js` and `src/navigation/TabNavigation.js`.

### NFC System

NFC is core functionality. Three service files handle all operations:

- **`NFCService.ts`** — Singleton. Read, write, format tags. Platform-specific retry mechanisms (3 attempts iOS, 2 Android). Multiple decoding fallbacks (NDEF → manual → TextDecoder). JSON normalization.
- **`NFCSecurityService.ts`** — Lock/unlock tags. NTAG detection (213/215/216), hardware-based protection via NfcA transceive commands with software XOR fallback, PWD_AUTH.
- **`NFCSimulator.ts`** — Test simulator with configurable failure rates. Auto-enabled in Jest tests. Simulates all NFC operations without hardware.

**NFC UI** lives in `src/screens/home/components/NFCManager/`:
- `NFCManagerModal.js` — Main modal container
- `NFCManagerNav.tsx` — Tab navigation within modal
- Tabs: ReadTab, EditTab, FormatTab, WriteTab, LockTab, UnlockTab

**NFC Utilities:**
- `src/utils/NFCUtils.ts` — Older NFC utility functions
- `src/utils/NFCLogger.ts` — Sentry-integrated operation logging with error categorization

NFC testing requires physical devices — simulators don't support NFC. The NFCSimulator is auto-enabled in Jest via `jest.setup.js`.

### Custom Hooks (in `src/screens/home/hooks/`)
- **`useDevices.js`** — Fetch devices with active assignments (parallel API calls), assign/return operations, pull-to-refresh
- **`useLocations.js`** — Full CRUD for locations, pull-to-refresh
- **`useNFCOperations.js`** — NFC operation handling for home screen flows

### Key Utilities (`src/utils/CommonUtils.js`)
- `Colors` constants used throughout the app
- Status/type choice enums for reports and devices
- Validation functions (email, phone, URL, UK postcode)
- Formatting (currency, date, capitalize, truncate)
- API error handling that skips 401s (handled globally by AuthContext)

## Testing

Jest config is in `package.json`. Test environment: `node`. Uses `ts-jest` for TypeScript, `babel-jest` for JavaScript.

**`jest.setup.js`** mocks: AsyncStorage, Sentry (full API), NFC Manager (all technologies), Expo modules (SecureStore, SQLite, Font, LinearGradient), Axios with interceptors, Vector Icons. NFCSimulator is auto-enabled.

Test directories: `src/tests/unit/`, `src/tests/component/`, `src/tests/integration/`, `src/tests/e2e/`. Some tests also live in `__tests__/` directories alongside components.

## Build Configuration

- iOS: Deployment target 17.0+, Hermes engine
- Android: Min SDK 24, Target/Compile SDK 35, Hermes engine
- EAS profiles: `development` (internal), `preview` (APK), `production` (auto-increment), `development-simulator` (iOS sim)
- `.env` is tracked in git (contains non-sensitive `MOBILE_API_KEY`)
- No ESLint/Prettier configured

## Important Instructions
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary for achieving goals
- ALWAYS prefer editing existing files to creating new ones
- NEVER proactively create documentation files unless explicitly requested
