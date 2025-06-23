import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useStripe, usePaymentSheet } from '@stripe/stripe-react-native';
import { useAuth } from '../context/AuthContext';
import Button from './Button';

const ORANGE_COLOR = '#FF9500';

const PaymentMethodManager = ({ 
  customerId,
  onPaymentMethodAdded,
  onError 
}) => {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const { axiosInstance } = useAuth();
  const [loading, setLoading] = useState(false);

  const addPaymentMethod = async () => {
    try {
      setLoading(true);

      // Create setup intent for adding payment method
      const response = await axiosInstance.post('/billing/create-setup-intent/', {
        customer_id: customerId,
      });

      const { 
        setup_intent_client_secret, 
        customer_id: stripecustomerId, 
        ephemeral_key_secret 
      } = response.data;

      // Initialize PaymentSheet for setup
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'WrapBattz',
        customerId: stripecustomerId,
        customerEphemeralKeySecret: ephemeral_key_secret,
        setupIntentClientSecret: setup_intent_client_secret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          name: 'WrapBattz Customer',
        },
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
        throw new Error(`PaymentSheet init error: ${initError.message}`);
      }

      // Present the PaymentSheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          return; // User canceled, don't show error
        }
        throw new Error(`Payment error: ${presentError.message}`);
      }

      // Payment method was successfully added
      Alert.alert(
        'Payment Method Added', 
        'Your payment method has been successfully added and saved.'
      );

      onPaymentMethodAdded && onPaymentMethodAdded();

    } catch (error) {
      console.error('Add payment method error:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to add payment method. Please try again.'
      );
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