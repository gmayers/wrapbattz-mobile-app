# Stripe Integration Setup Guide

This guide will help you complete the Stripe integration for the WrapBattz mobile app.

## Prerequisites

1. A Stripe account (sign up at https://stripe.com if you don't have one)
2. Access to your Stripe Dashboard
3. Django backend with dj-stripe configured
4. Stripe webhook endpoint configured on your backend

## Step 1: Get Your Stripe Keys

### For Testing (Development)

1. Log in to your Stripe Dashboard
2. Navigate to: https://dashboard.stripe.com/test/apikeys
3. Copy your **Publishable key** (starts with `pk_test_`)
4. Update `src/config/stripe.js` line 10:
   ```javascript
   ? "pk_test_YOUR_ACTUAL_TEST_KEY_HERE" // Replace with your key
   ```

### For Production

1. In Stripe Dashboard, switch to **Live mode** (toggle in top right)
2. Navigate to: https://dashboard.stripe.com/apikeys
3. Copy your **Live Publishable key** (starts with `pk_live_`)
4. Update `src/config/stripe.js` line 11:
   ```javascript
   : "pk_live_YOUR_ACTUAL_LIVE_KEY_HERE" // Replace with your key
   ```

## Step 2: Verify Backend Configuration

Ensure your Django backend has these endpoints properly configured:

### Required Endpoints (from API docs)

- ✅ `POST /billing/setup-intent/` - Create SetupIntent for payment methods
- ✅ `POST /billing/customer-portal/` - Create customer portal session
- ✅ `GET /billing/subscriptions/` - Get user's subscriptions
- ✅ `POST /billing/subscriptions/switch_plan/` - Switch subscription plans
- ✅ `POST /billing/subscriptions/cancel_subscription/` - Cancel subscription
- ✅ `GET /billing/invoices/` - Get invoices
- ✅ `GET /billing/invoices/{id}/download_url/` - Get invoice PDF URL
- ✅ `GET /billing/payment-history/` - Get payment history
- ✅ `GET /billing/usage/` - Get usage data
- ✅ `GET /billing/analytics/` - Get analytics data
- ✅ `GET/PUT /billing/notification-preferences/` - Manage notifications

### Setup Intent Response Format

The `/billing/setup-intent/` endpoint should return:

```json
{
  "setup_intent_client_secret": "seti_...",
  "customer_id": "cus_...",
  "ephemeral_key_secret": "ek_test_..."
}
```

## Step 3: Configure Apple Pay (iOS Only)

### Update Merchant Identifier

1. Check your Apple Developer account for your merchant ID
2. If it's different from `merchant.com.wrapbattz.app`, update `src/config/stripe.js` line 14:
   ```javascript
   merchantIdentifier: "merchant.YOUR_ACTUAL_MERCHANT_ID",
   ```

### Enable Apple Pay in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/settings/payment_methods
2. Enable **Apple Pay**
3. Add your domain and merchant identifier

## Step 4: Test the Integration

### Test Payment Method Addition

1. Start your app in development mode: `npm start`
2. Navigate to: Profile → Manage Billing
3. Tap "Manage Payment Methods"
4. Try adding a test card:
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

### Test Subscription Management

1. View current subscription status
2. Try switching plans (monthly ↔ annual)
3. View invoices and payment history
4. Check analytics dashboard

### Test Stripe Test Cards

Use these test cards for different scenarios:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`
- **Insufficient funds**: `4000 0000 0000 9995`

Full list: https://stripe.com/docs/testing

## Step 5: Verify Webhook Configuration

### On Your Django Backend

1. Ensure webhooks are configured at: https://dashboard.stripe.com/test/webhooks
2. Your webhook endpoint should be: `https://webportal.battwrapz.com/webhooks/stripe/`
3. Required webhook events for dj-stripe:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_method.attached`
   - `payment_method.detached`

### Test Webhooks

1. In Stripe Dashboard → Webhooks
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Choose an event type (e.g., `customer.subscription.updated`)
5. Verify it's received successfully on your backend

## Step 6: Deep Link Configuration (Already Set Up)

The app is already configured with the URL scheme `wrapbattz://` for Stripe redirects.

Verify in `app.json`:
- Line 63: `"scheme": "wrapbattz"`
- iOS info.plist already includes the scheme

## Troubleshooting

### "Stripe key not configured" Warning

- Make sure you've replaced `YOUR_ACTUAL_TEST_KEY_HERE` with your real key
- Restart the app after updating the config file

### "Failed to initialize payment methods"

- Check that `/billing/setup-intent/` endpoint is accessible
- Verify the endpoint returns the correct response format
- Check network logs for the exact error

### Payment Method Not Appearing

- Ensure the backend properly stores the payment method
- Check that the customer is correctly linked to the organization
- Verify RLS policies on the backend allow access

### Apple Pay Not Working

- Apple Pay only works on physical iOS devices
- Verify merchant identifier is correct
- Check that Apple Pay is enabled in Stripe Dashboard
- Ensure app is signed with correct provisioning profile

### Invoice Download Fails

- Verify `/billing/invoices/{id}/download_url/` endpoint exists
- Check that the invoice exists in Stripe
- Ensure the invoice has a PDF available

## Backend Requirements Checklist

For the frontend to work correctly, your Django backend must:

- [ ] Have dj-stripe properly configured
- [ ] Return ephemeral keys in SetupIntent endpoint
- [ ] Have customer portal enabled
- [ ] Have webhooks configured and verified
- [ ] Support all billing API endpoints listed above
- [ ] Have Row Level Security (RLS) properly configured
- [ ] Return data in expected format (not wrapped in extra objects)

## Mobile App Features

### Implemented Billing Screens

1. **ManageBillingScreen** (`src/screens/PaymentScreens/ManageBillingScreen.js`)
   - View subscription status
   - Manage payment methods
   - Switch plans
   - Cancel subscription
   - View recent invoices

2. **PaymentHistoryScreen** (`src/screens/PaymentScreens/PaymentHistoryScreen.js`)
   - Complete payment transaction history
   - Download receipts
   - View payment status

3. **BillingAnalyticsScreen** (`src/screens/PaymentScreens/BillingAnalyticsScreen.js`)
   - Usage trends
   - Cost projections
   - Monthly cost charts

4. **NotificationPreferencesScreen** (`src/screens/PaymentScreens/NotificationPreferencesScreen.js`)
   - Configure billing notifications
   - Set cost threshold alerts

### Stripe Components

1. **CustomerSheetManager** (`src/components/CustomerSheetManager.js`)
   - Modern Stripe CustomerSheet for payment method management
   - Uses Stripe Elements UI

2. **PaymentMethodManager** (`src/components/PaymentMethodManager.js`)
   - Alternative payment method management
   - Uses PaymentSheet

3. **StripePaymentSheet** (`src/components/StripePaymentSheet.js`)
   - For one-time payments (if needed)

## Production Deployment

Before deploying to production:

1. [ ] Replace test Stripe keys with live keys
2. [ ] Test all billing flows in production mode
3. [ ] Verify webhooks are working in live mode
4. [ ] Test Apple Pay on physical devices
5. [ ] Verify all invoices generate correctly
6. [ ] Test subscription cancellation and reactivation
7. [ ] Ensure proper error handling for failed payments
8. [ ] Test with real payment methods (small amounts)
9. [ ] Verify email notifications are sent
10. [ ] Check that analytics data is accurate

## Support & Documentation

- Stripe React Native SDK: https://stripe.dev/stripe-react-native/
- Stripe API Docs: https://stripe.com/docs/api
- dj-stripe Docs: https://dj-stripe.readthedocs.io/
- Testing Guide: https://stripe.com/docs/testing

## Questions?

If you encounter issues:

1. Check the browser/mobile console for errors
2. Review the backend logs for API errors
3. Check Stripe Dashboard logs for webhook events
4. Verify API key permissions in Stripe Dashboard
5. Ensure all packages are up to date

## Next Steps

1. Add your Stripe publishable keys to `src/config/stripe.js`
2. Test the integration with Stripe test cards
3. Verify all billing screens work correctly
4. Configure webhooks on your backend
5. Test the complete subscription flow
6. Deploy to production when ready
