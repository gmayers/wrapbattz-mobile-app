# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WrapBattz is a React Native application for enterprise device management using NFC technology. Organizations can track, assign, and manage devices across multiple locations with role-based access control.

## Development Commands

```bash
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS  
npm run ios

# Run in web browser
npm run web

# Install dependencies
npm install

# Testing
npm test                    # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
npm run test:ci            # Run tests for CI (no watch)
npm run test:e2e           # Run end-to-end tests with Detox
npm run test:e2e:build     # Build for E2E testing
npm run test:e2e:clean     # Clean E2E framework cache

# Build for production
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Architecture

### State Management
- React Context API for global state (AuthContext, SQLiteContext)
- SQLite for offline storage with API sync
- AsyncStorage for persistent data
- SecureStore for sensitive credentials

### API Layer
- Two Axios instances: standard (JWT) and mobile (API key)
- Automatic token refresh on 401 errors
- Base URL: https://battwrapz.gmayersservices.com/api/
- Offline-first approach with SQLite fallback

### Payment Integration
- Stripe integration for subscriptions
- Billing portal for payment method management
- PDF invoice downloads

### Navigation Structure
```
AuthStack → OnboardingStack → MainStack
              ↓                    ↓
         Create Organization   Tab Navigation
                              (Home, Reports, Locations, Profile)
```

### Key Patterns
- Functional components with hooks
- Custom hooks for data fetching (useDevices, useLocations)
- Modal-based flows for complex operations (NFC scanning, device assignment)
- Role-based UI rendering (Owner/Admin/User)
- TypeScript configuration available (mixed JS/TS codebase)

## NFC Operations

The app heavily uses NFC for device identification. Key NFC flows:
- Write: Format tag → Write device data (iOS optimized with retry mechanism)
- Read: Scan tag → Parse device info
- Lock/Unlock: Password-protect tags

NFC testing requires physical devices - simulators don't support NFC. Development builds are required for NFC functionality.

## Offline Storage

SQLite is used for offline-first data storage:
- Locations, devices, assignments, reports
- Auto-sync when online
- Role-based data access
- Migration system for schema updates

## Error Tracking

Sentry integration for production error monitoring:
- Automatic crash reporting
- Performance monitoring
- Only enabled in production builds

## Code Organization

### Utilities
- `src/utils/CommonUtils.js` - Shared utilities to reduce code duplication
- Common validation, formatting, error handling
- NFC utilities and status helpers

### TypeScript
- tsconfig.json configured for gradual adoption
- Path aliases for cleaner imports
- Mixed JS/TS codebase supported

## Testing & Development Notes

- Jest configured with React Native preset and TypeScript support
- Testing Library React Native for component testing
- Detox configured for E2E testing
- Path aliases configured (@/ maps to src/) in both tsconfig and Jest
- No linting rules defined
- Development builds are required for NFC features
- API key is stored in SecureStore after first launch
- Check device permissions before NFC operations
- Use CommonUtils for shared functionality