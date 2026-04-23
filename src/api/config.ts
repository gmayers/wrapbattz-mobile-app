export const API_BASE_URL = 'https://app.tooltraq.com/api/v1';

export const REQUEST_TIMEOUT_MS = 15_000;

// Shorter ceiling for calls made on the splash screen, where a hung request
// leaves the user staring at a spinner. Bootstrap fails fast and lets the
// login screen render if the device is offline.
export const BOOTSTRAP_TIMEOUT_MS = 6_000;
