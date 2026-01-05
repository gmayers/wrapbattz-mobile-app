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

# Run single test file or pattern
npm test -- path/to/test.js
npm test -- --testNamePattern="specific test"
npm test -- -t "test description pattern"

# Build for production
eas build --platform android --profile production
eas build --platform ios --profile production

# Development builds
eas build --platform android --profile development
eas build --platform ios --profile development

# iOS setup (macOS only)
cd ios && pod install && cd ..

# Clear Metro cache
expo start -c
```

## Setup Requirements

1. Install dependencies: `npm install`
2. For iOS development: `cd ios && pod install && cd ..`
3. Physical device required for NFC testing (simulators don't support NFC)
4. Development build required for NFC functionality
5. Supabase project configured (see Supabase Setup section below)

## Architecture

### Tech Stack
- React Native 0.76.9 with Expo SDK 52
- Mixed JavaScript/TypeScript codebase
- React Navigation v7 for navigation
- **Supabase** for backend (PostgreSQL database, auth, storage)
- Axios for API calls (legacy, being phased out)
- SQLite for offline storage (optional fallback)
- Stripe for payments
- Sentry for error tracking

### State Management
- React Context API for global state (AuthContext, SQLiteContext)
- SQLite for offline storage with API sync
- AsyncStorage for persistent data
- SecureStore for sensitive credentials

### API Layer
- **Primary**: Supabase client with automatic auth token management
- Supabase services in `src/services/supabase/` (device, assignment, location, report, organization, storage)
- Row Level Security (RLS) enforces multi-tenant data isolation
- Legacy: Two Axios instances for backward compatibility (being phased out)
- Offline-first approach with SQLite fallback (optional)

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

### Project Structure
```
src/
├── components/     # Reusable UI components
├── config/        # Configuration (Stripe, etc.)
├── context/       # React Context providers
├── navigation/    # Navigation setup
├── screens/       # Screen components by feature
├── services/      # API and NFC services
├── tests/         # Test files
├── types/         # TypeScript definitions
└── utils/         # Utility functions
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

## Testing

### Test Organization
- Unit tests: `src/tests/unit/`
- Component tests: `src/tests/component/`
- Integration tests: `src/tests/integration/`
- E2E tests: `src/tests/e2e/`

### Testing Stack
- Jest with React Native preset and TypeScript support
- React Native Testing Library for component testing
- Detox for E2E testing
- Coverage reports generated in `coverage/` directory
- Extensive mocking setup in `jest.setup.js`

## Development Notes

- Path aliases configured (@/ maps to src/) in both tsconfig and Jest
- No linting rules defined - project does not use ESLint/Prettier
- Development builds required for NFC features
- API key stored in SecureStore after first launch
- Check device permissions before NFC operations
- Use CommonUtils for shared functionality
- .env file is tracked in git (contains non-sensitive config: MOBILE_API_KEY)

## Build Configuration

### EAS Build Profiles
- `development`: Development client with internal distribution
- `preview`: APK build for Android testing
- `production`: Auto-increment version for app stores
- `development-simulator`: Development build for iOS simulator

### Platform Requirements
- iOS: Deployment target 17.0+, requires Hermes engine
- Android: Min SDK 24, Target/Compile SDK 35, requires Hermes engine
- NFC permissions and entitlements configured for both platforms

## Supabase Setup

### Initial Configuration

1. **Create Supabase Project**
   - Sign up at https://supabase.com
   - Create new project
   - Save project URL and anon key

2. **Update Environment Variables**
   ```bash
   # Edit .env file with your Supabase credentials
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run Database Migrations**
   ```bash
   # Install Supabase CLI (if not already installed)
   npm install -g supabase

   # Link to your project
   supabase link --project-ref your-project-ref

   # Run migrations in order
   supabase db push
   ```

   Migrations are located in `supabase/migrations/` and include:
   - Users, organizations, and members tables
   - Devices, assignments, and locations
   - Reports and photos
   - Billing tables (Stripe integration)
   - Helper functions and RLS policies
   - Performance indexes

4. **Configure Storage Buckets**
   Buckets are auto-created from `supabase/config.toml`:
   - `device-photos` - Device images (10MB limit, private)
   - `report-photos` - Report attachments (10MB limit, private)
   - `invoices` - PDF invoices (5MB limit, private)

5. **Set Up Authentication**
   - Enable email/password authentication in Supabase dashboard
   - Configure email templates (confirmation, password reset)
   - Set site URL: `wrapbattz://app`
   - Add redirect URLs: `wrapbattz://auth/callback`

### Database Structure

**Key Tables:**
- `users` - User profiles (extends auth.users)
- `organizations` - Company/org information with auto-generated invite codes
- `organization_members` - User-org relationships with roles (owner, admin, office_worker, site_worker)
- `locations` - Physical locations for device assignment
- `devices` - Device inventory with status tracking
- `device_assignments` - Assignment history (user or location)
- `device_photos` - Photo references in Supabase Storage
- `reports` - Incident reports with auto-status updates
- Billing tables - Stripe integration (subscriptions, invoices, payments)

**Row Level Security (RLS):**
- All tables have RLS enabled
- Multi-tenant security: users only access their organization's data
- Role-based permissions (owner/admin have elevated access)
- Helper functions: `get_user_org_id()`, `get_user_role()`, `is_admin_or_owner()`

### Using Supabase Services

```javascript
import {
  deviceService,
  assignmentService,
  locationService,
  reportService,
  organizationService,
  storageService,
} from './src/services/supabase';

// Example: Get all devices
const devices = await deviceService.getAllDevices();

// Example: Create assignment
const assignment = await assignmentService.assignDeviceToMe(deviceId);

// Example: Upload photo
const result = await storageService.uploadDevicePhoto(file, deviceId);
```

### Troubleshooting

**Migrations fail:**
- Check migration order (must run sequentially)
- Verify foreign key dependencies
- Check Supabase logs: `supabase logs db`

**RLS blocks queries:**
- Verify user is authenticated
- Check user has organization membership
- Validate custom JWT claims are set
- Test with service role key (bypasses RLS)

**Auth issues:**
- Verify email confirmation is enabled
- Check redirect URLs match app scheme
- Ensure JWT expiry settings are appropriate

### Documentation
- Full setup guide: `supabase/README.md`
- Database schema: See migration files in `supabase/migrations/`
- API examples: Each service file has JSDoc comments

## Important Instructions
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary for achieving goals
- ALWAYS prefer editing existing files to creating new ones
- NEVER proactively create documentation files unless explicitly requested