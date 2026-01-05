# Session Expiry Fix - Preventing Duplicate Alerts

## Problem

Previously, the app showed 3-5 duplicate "Session Expired" alerts when the authentication token expired. This happened because:

1. Multiple components/hooks were making API calls simultaneously
2. When the token expired, all these calls failed with 401 errors
3. Each component was handling the 401 error independently
4. Result: Multiple alerts showing at the same time

## Solution

Implemented a **global session expiry handler** using axios response interceptors:

### Key Changes

1. **Global Response Interceptor** (`src/context/AuthContext.js`)
   - Added response interceptor to `axiosInstance`
   - Automatically catches all 401 errors
   - Attempts to refresh the token silently
   - If refresh fails, shows ONE alert and logs out
   - Uses a flag (`isSessionExpiredAlertShowing`) to prevent duplicates

2. **Updated CommonUtils** (`src/utils/CommonUtils.js`)
   - Modified `handleApiError()` to skip 401 errors
   - 401 errors are now handled globally, not per-component

3. **Improved AuthContext** (`src/context/AuthContext.js`)
   - `checkAuthState()` now properly detects when tokens are missing
   - Automatically logs out user when no access token is found

### How It Works

```
1. Multiple API calls made → Token is expired
2. All calls return 401 → Interceptor catches them
3. Interceptor tries token refresh → Refresh token also expired
4. Show ONE alert (flag prevents duplicates)
5. Clear all auth data
6. Redirect to login screen
```

### Automatic Token Refresh

The interceptor also handles **silent token refresh**:

- When access token expires but refresh token is valid
- Automatically refreshes the access token
- Retries the failed request with the new token
- User never sees an error

### Components No Longer Need To Handle Session Expiry

All components that previously had this code can now remove it:

```javascript
// ❌ OLD WAY - No longer needed
if (error.response?.status === 401) {
  Alert.alert(
    'Session Expired',
    'Your session has expired. Please login again.',
    [{ text: 'OK', onPress: logout }]
  );
}
```

The global interceptor handles this automatically!

### Affected Components (Already Fixed)

These components had session expiry handling that's now redundant:

- `src/utils/CommonUtils.js` ✅ Updated
- `src/screens/AllReportsScreen.js` - Can be cleaned up later
- `src/screens/AllDevicesScreen.js` - Can be cleaned up later
- `src/screens/DeviceDetailsScreen.js` - Can be cleaned up later
- `src/screens/ReportDetailsScreen.js` - Can be cleaned up later
- `src/screens/LocationsScreen.js` - Can be cleaned up later
- `src/screens/LocationDetailsScreen.js` - Can be cleaned up later
- `src/screens/ReportsScreen.js` - Can be cleaned up later
- `src/screens/CreateReportScreen.js` - Can be cleaned up later
- `src/screens/AddLocations.js` - Can be cleaned up later
- `src/screens/home/hooks/useDevices.js` - Can be cleaned up later
- `src/screens/home/hooks/useLocations.js` - Can be cleaned up later
- `src/screens/HomeScreen/hooks/useDevices.ts` - Can be cleaned up later
- `src/screens/HomeScreen/hooks/useLocations.ts` - Can be cleaned up later

**Note:** These components will still work fine as-is since the interceptor prevents the 401 error from reaching them. The individual handlers become redundant but won't cause issues.

### Testing

To test the fix:

1. Log in to the app
2. Wait for token to expire (or manually delete it from AsyncStorage)
3. Try to navigate or refresh data
4. You should see ONLY ONE "Session Expired" alert
5. After clicking OK, you should be redirected to login screen

### Code Location

**Main Implementation:**
- `src/context/AuthContext.js` - Lines 19-115 (response interceptor)
- `src/context/AuthContext.js` - Lines 546-596 (improved checkAuthState)
- `src/utils/CommonUtils.js` - Lines 170-196 (updated handleApiError)

### Benefits

✅ **No more duplicate alerts**
✅ **Automatic token refresh** when possible
✅ **Cleaner component code** - no need to handle 401s individually
✅ **Centralized session management**
✅ **Better user experience**

### Future Improvements (Optional)

1. Remove redundant 401 handling from individual components
2. Add a "Session expiring soon" warning
3. Implement token refresh before it expires
4. Add retry logic for failed requests
