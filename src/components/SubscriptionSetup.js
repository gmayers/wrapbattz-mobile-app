import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import { STRIPE_CONFIG } from '../config/stripe';
import { billingService } from '../services/BillingService';
import Button from './Button';

const ORANGE_COLOR = '#FF9500';

/**
 * SubscriptionSetup - Complete flow for setting up a subscription
 *
 * This component handles:
 * 1. Free tier activation (0 billable devices)
 * 2. Paid subscription setup with payment method collection
 *
 * Flow for paid subscriptions:
 * 1. Create SetupIntent
 * 2. Present PaymentSheet to collect payment method
 * 3. Stripe automatically confirms SetupIntent and attaches payment method
 * 4. Create subscription using customer's default payment method
 */
const SubscriptionSetup = ({
  selectedPlan,
  billableDevices,
  totalDevices,
  onSubscriptionSuccess,
  onSubscriptionError,
  onCancel
}) => {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [loading, setLoading] = useState(false);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  // Get the tier based on TOTAL devices
  const getTierInfo = (totalDevices) => {
    // Tier determined by total device count
    if (totalDevices <= 100) {
      return {
        name: '1-100 Stickers',
        monthlyRate: 0.40,
        annualRate: 0.25
      };
    } else if (totalDevices <= 400) {
      // 101-400 stickers tier (triggers at 101 total)
      return {
        name: '101-400 Stickers',
        monthlyRate: 0.33,
        annualRate: 0.25
      };
    } else {
      return {
        name: '400+ Stickers',
        monthlyRate: 0.25,
        annualRate: 0.25
      };
    }
  };

  // Calculate cost - all billable devices at the same rate based on tier
  const calculateAmount = () => {
    if (billableDevices <= 0) return 0;

    const totalDevs = totalDevices || (billableDevices + 3);
    const tierInfo = getTierInfo(totalDevs);
    const rate = selectedPlan === 'monthly' ? tierInfo.monthlyRate : tierInfo.annualRate;
    const monthlyCost = billableDevices * rate;

    // For annual, multiply by 12 months to get yearly total
    return selectedPlan === 'annual' ? monthlyCost * 12 : monthlyCost;
  };

  const getPlanSlug = () => {
    return selectedPlan === 'monthly' ? 'monthly-device-billing' : 'annual-device-billing';
  };

  const setupFreeTier = async () => {
    try {
      setLoading(true);

      // Activate free tier without payment
      await billingService.activateFreeTier();

      Alert.alert(
        'Free Tier Activated!',
        'Your account has been set up with the free tier. You can manage up to 3 devices at no cost.',
        [
          {
            text: 'OK',
            onPress: () => onSubscriptionSuccess && onSubscriptionSuccess()
          }
        ]
      );

    } catch (error) {
      console.error('Free tier activation error:', error);
      Alert.alert(
        'Activation Failed',
        error.response?.data?.detail || error.message || 'There was an error activating your free tier. Please try again.'
      );
      onSubscriptionError && onSubscriptionError(error);
    } finally {
      setLoading(false);
    }
  };

  const setupPaidSubscription = async () => {
    try {
      setLoading(true);

      // Step 1: Create SetupIntent for payment method collection
      const setupIntentResponse = await billingService.createSetupIntent();

      const {
        setup_intent_client_secret,
        customer_id,
        ephemeral_key_secret
      } = setupIntentResponse;

      if (!setup_intent_client_secret || !customer_id || !ephemeral_key_secret) {
        throw new Error('Invalid setup intent response from server');
      }

      // Step 2: Initialize PaymentSheet with SetupIntent
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'WrapBattz',
        customerId: customer_id,
        customerEphemeralKeySecret: ephemeral_key_secret,
        setupIntentClientSecret: setup_intent_client_secret,
        returnURL: 'wrapbattz://stripe-redirect',
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          email: setupIntentResponse.customer_email || '',
        },
        appearance: STRIPE_CONFIG.appearance,
      });

      if (initError) {
        throw new Error(`PaymentSheet initialization failed: ${initError.message}`);
      }

      // Step 3: Present the PaymentSheet to user
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          console.log('User canceled payment sheet');
          onCancel && onCancel();
          return;
        }
        throw new Error(`Payment collection failed: ${presentError.message}`);
      }

      // Step 4: Payment method was successfully attached!
      // When PaymentSheet confirms a SetupIntent, Stripe automatically:
      // - Attaches the payment method to the customer
      // - Sets it as the default payment method
      // Now we can create the subscription - backend will use the default payment method

      // Step 5: Create subscription
      // Backend will use the customer's default payment method (just attached)
      const subscriptionData = {
        plan_slug: getPlanSlug(),
        device_count: totalDevices || billableDevices + 3, // Total devices including free tier
        // Note: payment_method_id not needed - backend uses customer's default
      };

      try {
        await billingService.createSubscription(subscriptionData);
      } catch (subError) {
        // If subscription creation fails, provide helpful error message
        console.error('Subscription creation error:', subError);
        throw new Error(
          subError.response?.data?.detail ||
          subError.response?.data?.error ||
          'Failed to create subscription. Your payment method was added but subscription creation failed. Please contact support.'
        );
      }

      // Step 6: Success!
      const amount = calculateAmount();
      const period = selectedPlan === 'monthly' ? 'per month' : 'per year';

      Alert.alert(
        'Subscription Activated!',
        `Your ${selectedPlan} subscription has been successfully set up. You'll be charged £${amount.toFixed(2)} ${period}.`,
        [
          {
            text: 'OK',
            onPress: () => onSubscriptionSuccess && onSubscriptionSuccess()
          }
        ]
      );

    } catch (error) {
      console.error('Subscription setup error:', error);

      // Provide user-friendly error messages
      let errorTitle = 'Subscription Setup Failed';
      let errorMessage = 'There was an error setting up your subscription. Please try again.';

      if (error.response?.status === 404) {
        errorTitle = 'Billing Service Not Available';
        errorMessage = 'The billing service endpoint was not found. This usually means billing is not properly configured on the server. Please contact support.';
      } else if (error.response?.status === 400) {
        errorTitle = 'Invalid Request';
        errorMessage = error.response?.data?.detail || error.response?.data?.error || 'Invalid subscription details. Please check your inputs and try again.';
      } else if (error.response?.status === 500) {
        errorTitle = 'Server Error';
        const serverDetail = error.response?.data?.detail || error.response?.data?.error;
        errorMessage = serverDetail
          ? `Server error: ${serverDetail}\n\nThis usually indicates a backend configuration issue. Please contact your administrator.`
          : 'A server error occurred. This typically means:\n\n• Stripe API keys not configured on backend\n• Database connection issue\n• Billing service not properly set up\n\nPlease contact your administrator or check backend logs.';
      } else if (error.message?.includes('Network Error')) {
        errorTitle = 'Network Error';
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(errorTitle, errorMessage);
      onSubscriptionError && onSubscriptionError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    if (billableDevices <= 0) {
      // Free tier - no payment needed
      await setupFreeTier();
    } else {
      // Paid subscription - collect payment
      await setupPaidSubscription();
    }
  };

  // Auto-trigger payment setup on mount for paid subscriptions
  // This skips the subscription summary screen and goes directly to PaymentSheet
  React.useEffect(() => {
    if (!hasAutoTriggered && billableDevices > 0) {
      setHasAutoTriggered(true);
      // Small delay to ensure component is fully mounted
      setTimeout(async () => {
        try {
          await setupPaidSubscription();
        } catch (error) {
          // Error is already handled in setupPaidSubscription
          console.error('Auto-trigger subscription setup failed:', error);
        }
      }, 300); // Increased delay to 300ms for stability
    }
  }, []);

  // Show loading state while auto-triggering payment setup
  if (billableDevices > 0 && (!hasAutoTriggered || loading)) {
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
        <Text style={styles.summaryText}>
          Plan: {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
        </Text>
        <Text style={styles.summaryText}>
          Tier: {getTierInfo(totalDevices || billableDevices + 3).name}
        </Text>
        <Text style={styles.summaryText}>
          Total Devices: {totalDevices || billableDevices + 3}
        </Text>
        <Text style={styles.summaryText}>
          Free Devices: 3
        </Text>
        <Text style={styles.summaryText}>
          Billable Devices: {billableDevices}
        </Text>
        <Text style={[styles.summaryText, styles.costText]}>
          Cost: £{calculateAmount().toFixed(2)} {selectedPlan === 'monthly' ? 'per month' : 'per year'}
        </Text>
      </View>

      <Button
        title={
          loading
            ? 'Setting up...'
            : billableDevices <= 0
            ? 'Activate Free Tier'
            : `Subscribe - £${calculateAmount().toFixed(2)}/${selectedPlan === 'monthly' ? 'mo' : 'yr'}`
        }
        onPress={handleSetup}
        disabled={loading}
        style={styles.subscribeButton}
        icon={loading ? <ActivityIndicator size="small" color="white" /> : null}
      />

      {billableDevices <= 0 && (
        <Text style={styles.noChargeText}>
          No payment required - you're using the free tier (up to 3 devices)
        </Text>
      )}

      {billableDevices > 0 && (
        <Text style={styles.helperText}>
          You'll be prompted to add a payment method to complete your subscription.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  summaryBox: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  costText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  subscribeButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
    minHeight: 48,
  },
  noChargeText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 8,
    fontWeight: '500',
  },
  helperText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default SubscriptionSetup;
