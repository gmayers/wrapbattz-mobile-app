// Stripe configuration
//
// ============================================================================
// IMPORTANT: ADD YOUR STRIPE PUBLISHABLE KEYS BELOW
// ============================================================================
//
// 1. Get your TEST key from: https://dashboard.stripe.com/test/apikeys
//    - Copy the "Publishable key" (starts with pk_test_)
//    - Replace pk_test_YOUR_ACTUAL_TEST_KEY_HERE below
//
// 2. Get your LIVE key from: https://dashboard.stripe.com/apikeys
//    - Copy the "Publishable key" (starts with pk_live_)
//    - Replace pk_live_YOUR_ACTUAL_LIVE_KEY_HERE below
//
// 3. Restart your development server after changing keys
//
// NOTE: These are PUBLISHABLE keys (safe to include in app), not SECRET keys
// ============================================================================

export const STRIPE_CONFIG = {
  publishableKey: __DEV__
    ? "pk_test_51SRw87Df0YSwO3Xvn6PKAp7us1hF7VyhfCMqwH11jFQ1QjG2VfrDne7MEkJG1A56RAxSvMPx6vvxk7Z3Ujw6iwxL00hnf7uSKd" // ⚠️ REPLACE with your Stripe TEST publishable key
    : "pk_live_YOUR_ACTUAL_LIVE_KEY_HERE", // ⚠️ REPLACE with your Stripe LIVE publishable key

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
      primary: '#FF9500',        // Orange brand color
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