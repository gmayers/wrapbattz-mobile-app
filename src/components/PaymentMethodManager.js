import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import { billingService } from '../services/BillingService';
import Button from './Button';

const ORANGE_COLOR = '#FF9500';

/**
 * PaymentMethodManager - Simplified component for adding payment methods
 *
 * This is a lightweight alternative to CustomerSheetManager focused only
 * on adding payment methods via PaymentSheet with SetupIntent.
 *
 * Use this when you just need to add a payment method without showing
 * the full management UI.
 */
const PaymentMethodManager = ({
  customerId,
  onPaymentMethodAdded,
  onError
}) => {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [loading, setLoading] = useState(false);

  const addPaymentMethod = async () => {
    try {
      setLoading(true);

      // Create setup intent for adding payment method
      const setupIntentData = await billingService.createSetupIntent();

      // Validate response
      if (!setupIntentData.setup_intent_client_secret || !setupIntentData.customer_id) {
        throw new Error('Invalid setup intent response from server');
      }

      const {
        setup_intent_client_secret,
        customer_id: stripeCustomerId,
        ephemeral_key_secret,
        customer_email
      } = setupIntentData;

      // Initialize PaymentSheet for setup
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'WrapBattz',
        customerId: stripeCustomerId || customerId,
        customerEphemeralKeySecret: ephemeral_key_secret,
        setupIntentClientSecret: setup_intent_client_secret,
        returnURL: 'wrapbattz://stripe-redirect',
        defaultBillingDetails: {
          email: customer_email || '',
        },
        allowsDelayedPaymentMethods: false,
        appearance: {
          colors: {
            primary: ORANGE_COLOR,
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
        },
      });

      if (initError) {
        throw new Error(`PaymentSheet initialization error: ${initError.message}`);
      }

      // Present the PaymentSheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          console.log('Payment sheet canceled by user');
          return; // User canceled, don't show error
        }
        throw new Error(`Payment error: ${presentError.message}`);
      }

      // Payment method was successfully added
      Alert.alert(
        'Success',
        'Your payment method has been added successfully',
        [{ text: 'OK' }]
      );

      // Callback to refresh parent component
      onPaymentMethodAdded && onPaymentMethodAdded();

    } catch (error) {
      console.error('Add payment method error:', error);

      // User-friendly error messages
      let errorMessage = 'Failed to add payment method. Please try again.';

      if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail || error.response.data?.error;

        if (status === 404) {
          errorMessage = 'Billing service is not available. Please contact support.';
        } else if (status === 500) {
          errorMessage = detail || 'A server error occurred. Please contact support.';
        } else if (status === 403) {
          errorMessage = 'You don\'t have permission to add payment methods.';
        } else if (detail) {
          errorMessage = detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
      onError && onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Methods</Text>
      <Text style={styles.description}>
        Add a payment method to manage your subscription and billing.
      </Text>
      
      <Button
        title={loading ? 'Adding...' : 'Add Payment Method'}
        onPress={addPaymentMethod}
        disabled={loading}
        style={styles.addButton}
        icon={loading ? <ActivityIndicator size="small" color="white" /> : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#e3e3e3',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
  },
});

export default PaymentMethodManager;