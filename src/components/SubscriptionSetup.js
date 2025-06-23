import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useStripe, usePaymentSheet } from '@stripe/stripe-react-native';
import { useAuth } from '../context/AuthContext';
import { STRIPE_CONFIG } from '../config/stripe';
import Button from './Button';

const ORANGE_COLOR = '#FF9500';

const SubscriptionSetup = ({ 
  selectedPlan, 
  billableDevices, 
  onSubscriptionSuccess,
  onSubscriptionError,
  onCancel 
}) => {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const { axiosInstance } = useAuth();
  const [loading, setLoading] = useState(false);

  const calculateAmount = () => {
    const pricePerDevice = selectedPlan === 'monthly' ? 0.40 : 0.25;
    return pricePerDevice * billableDevices;
  };

  const setupSubscription = async () => {
    try {
      setLoading(true);

      // Create subscription setup intent on your backend
      const response = await axiosInstance.post('/billing/create-subscription-setup/', {
        plan_type: selectedPlan,
        device_count: billableDevices,
      });

      const { 
        setup_intent_client_secret, 
        customer_id, 
        ephemeral_key_secret,
        subscription_id 
      } = response.data;

      // Initialize PaymentSheet for subscription setup
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'WrapBattz',
        customerId: customer_id,
        customerEphemeralKeySecret: ephemeral_key_secret,
        setupIntentClientSecret: setup_intent_client_secret,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: 'WrapBattz Customer',
        },
        appearance: STRIPE_CONFIG.appearance,
      });

      if (initError) {
        throw new Error(`PaymentSheet init error: ${initError.message}`);
      }

      // Present the PaymentSheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          onCancel && onCancel();
          return;
        }
        throw new Error(`Payment error: ${presentError.message}`);
      }

      // Payment method was successfully attached
      // Confirm the subscription on the backend
      await axiosInstance.post('/billing/confirm-subscription/', {
        subscription_id: subscription_id,
      });

      Alert.alert(
        'Subscription Activated!', 
        `Your ${selectedPlan} subscription has been successfully set up. You'll be charged £${calculateAmount().toFixed(2)} ${selectedPlan === 'monthly' ? 'per month' : 'per year'}.`,
        [
          {
            text: 'OK',
            onPress: () => onSubscriptionSuccess && onSubscriptionSuccess()
          }
        ]
      );

    } catch (error) {
      console.error('Subscription setup error:', error);
      Alert.alert(
        'Subscription Setup Failed', 
        error.message || 'There was an error setting up your subscription. Please try again.'
      );
      onSubscriptionError && onSubscriptionError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>Subscription Summary</Text>
        <Text style={styles.summaryText}>
          Plan: {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
        </Text>
        <Text style={styles.summaryText}>
          Billable Devices: {billableDevices}
        </Text>
        <Text style={styles.summaryText}>
          Cost: £{calculateAmount().toFixed(2)} {selectedPlan === 'monthly' ? 'per month' : 'per year'}
        </Text>
      </View>

      <Button
        title={loading ? 'Setting up...' : `Subscribe - £${calculateAmount().toFixed(2)}/${selectedPlan === 'monthly' ? 'month' : 'year'}`}
        onPress={setupSubscription}
        disabled={loading || billableDevices <= 0}
        style={styles.subscribeButton}
        icon={loading ? <ActivityIndicator size="small" color="white" /> : null}
      />

      {billableDevices <= 0 && (
        <Text style={styles.noChargeText}>
          No payment required - you're using the free tier (up to 3 devices)
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
  subscribeButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
    minHeight: 48,
  },
  noChargeText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default SubscriptionSetup;