// Stripe configuration
export const STRIPE_CONFIG = {
  publishableKey: __DEV__ 
    ? "pk_test_51QZDNVCsQwvBrKrIBDUDdM6v7AKOawAGRHXxSo6Sp5qpQbJSvMQhQNhPNiN8V0fHqFdL9iOUBFTJOqr7O9j9xfZp00uQGZZZZZ" // Replace with actual test key
    : "pk_live_YOUR_LIVE_KEY_HERE", // Replace with actual live key
  
  merchantIdentifier: "merchant.com.wrapbattz.app",
  urlScheme: "wrapbattz",
  
  // Test mode configuration
  testMode: __DEV__,
  
  // Payment configuration
  currency: 'gbp',
  countryCode: 'GB',
  
  // Appearance configuration for consistency
  appearance: {
    colors: {
      primary: '#FF9500',
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