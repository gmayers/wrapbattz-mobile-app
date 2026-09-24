// Stripe configuration
//
// ============================================================================
// The publishable key comes from the environment, not from source:
//   - development / preview builds get it from eas.json's build.<profile>.env
//   - production gets it from an EAS environment variable (see eas.json)
//   - local `npm start` gets it from .env (gitignored)
// NOTE: This is a PUBLISHABLE key (safe to include in app), not a SECRET key.
// ============================================================================

export const STRIPE_CONFIG = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',

  // Apple Pay merchant identifier (must match your Apple Developer account)
  merchantIdentifier: "merchant.com.wrapbattz.app",

  // URL scheme for Stripe redirects (matches app.json scheme)
  urlScheme: "wrapbattz",

  // Test mode configuration
  testMode: __DEV__,

  // Payment configuration for UK market
  currency: 'gbp',
  countryCode: 'GB',

  // Appearance configuration for consistent branding
  appearance: {
    colors: {
      primary: '#FFC72C',        // TOOLTRAQ yellow
      background: '#ffffff',
      componentBackground: '#f6f6f6',
      componentBorder: '#e3e3e3',
      componentDivider: '#e3e3e3',
      primaryText: '#000000',
      secondaryText: '#6c6c6c',
      componentText: '#000000',
      placeholderText: '#a8a8a8',
    },
    shapes: {
      borderRadius: 8,
      borderWidth: 1,
    },
  }
};

// Helper function to validate Stripe keys
export const validateStripeConfig = () => {
  if (!STRIPE_CONFIG.publishableKey || STRIPE_CONFIG.publishableKey.includes('YOUR_')) {
    console.warn('⚠️ Stripe publishable key not configured properly');
    return false;
  }
  return true;
};

export default STRIPE_CONFIG;