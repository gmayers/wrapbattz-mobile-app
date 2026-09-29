import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { initStripe, usePaymentSheet } from '@stripe/stripe-react-native';
import { STRIPE_CONFIG } from '../config/stripe';
import { billingErrorMessage, isBillingForbidden } from '../api/billingErrors';
import { startCheckout } from '../api/endpoints/billing';
import Button from './Button';

const ORANGE_COLOR = '#FFC72C';

const formatCurrency = (minorUnits, currency = 'GBP') => {
  const amount = typeof minorUnits === 'number' ? minorUnits / 100 : 0;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
};

/**
 * Subscribes the organisation to a plan through Stripe's PaymentSheet.
 *
 * POST /billing/checkout/ does the whole server side in one call: it creates
 * the customer, the subscription and its first PaymentIntent, and hands back
 * everything PaymentSheet needs. That replaces the old two-step
 * SetupIntent-then-create-subscription dance, which relied on endpoints that
 * no longer exist.
 *
 * Checkout is owner-only, so a non-owner gets told why rather than a generic
 * failure.
 */
const SubscriptionSetup = ({
  planSlug,
  interval,
  planName,
  onSubscriptionSuccess,
  onSubscriptionError,
  onCancel
}) => {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [started, setStarted] = useState(false);

  const runCheckout = async () => {
    try {
      setLoading(true);

      const checkout = await startCheckout({ plan_slug: planSlug, interval });
      setQuote(checkout);

      if (!checkout.client_secret) {
        throw new Error('Invalid checkout response from server');
      }

      // The client secret belongs to the server's Stripe account; the key
      // bundled in the app may not (and is a placeholder in release builds).
      if (checkout.publishable_key) {
        await initStripe({
          publishableKey: checkout.publishable_key,
          merchantIdentifier: STRIPE_CONFIG.merchantIdentifier,
          urlScheme: STRIPE_CONFIG.urlScheme,
        });
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'ToolTraq',
        customerId: checkout.customer_id,
        customerEphemeralKeySecret: checkout.ephemeral_key ?? undefined,
        // The subscription's first invoice is a PaymentIntent, not a SetupIntent.
        paymentIntentClientSecret: checkout.client_secret,
        returnURL: `${STRIPE_CONFIG.urlScheme}://stripe-redirect`,
        allowsDelayedPaymentMethods: false,
        appearance: STRIPE_CONFIG.appearance,
      });

      if (initError) {
        throw new Error(`PaymentSheet initialization failed: ${initError.message}`);
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          onCancel && onCancel();
          return;
        }
        throw new Error(presentError.message || 'Payment collection failed');
      }

      Alert.alert(
        'Subscription Activated',
        `Your ${interval} subscription is set up. You'll be charged ${formatCurrency(checkout.amount, checkout.currency?.toUpperCase())} ${interval === 'monthly' ? 'per month' : 'per year'}.`,
        [{ text: 'OK', onPress: () => onSubscriptionSuccess && onSubscriptionSuccess() }]
      );
    } catch (error) {
      const title = isBillingForbidden(error)
        ? 'Access Denied'
        : 'Subscription Setup Failed';
      Alert.alert(
        title,
        billingErrorMessage(error, 'Unable to start checkout. Please try again later.')
      );
      onSubscriptionError && onSubscriptionError(error);
    } finally {
      setLoading(false);
    }
  };

  // The caller renders this component only once the user has chosen a plan,
  // so go straight to the sheet instead of asking them to confirm twice.
  useEffect(() => {
    if (started || !planSlug) return;
    setStarted(true);
    runCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSlug, interval]);

  if (loading || !started) {
    return (
      <View style={styles.container}>
        <View style={styles.summaryBox}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={[styles.summaryText, { textAlign: 'center', marginTop: 16 }]}>
            Preparing payment setup...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>Subscription Summary</Text>
        <Text style={styles.summaryText}>Plan: {planName ?? planSlug}</Text>
        <Text style={styles.summaryText}>
          Billing: {interval === 'monthly' ? 'Monthly' : 'Annual'}
        </Text>
        {quote && (
          <Text style={[styles.summaryText, styles.costText]}>
            Cost: {formatCurrency(quote.amount, quote.currency?.toUpperCase())}{' '}
            {interval === 'monthly' ? 'per month' : 'per year'}
          </Text>
        )}
      </View>

      <Button title="Try Again" onPress={runCheckout} style={styles.button} />
      <Button title="Cancel" onPress={onCancel} variant="outlined" style={styles.button} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  summaryBox: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 15,
    color: '#555',
    marginBottom: 6,
  },
  costText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  button: {
    marginBottom: 10,
  },
});

export default SubscriptionSetup;
