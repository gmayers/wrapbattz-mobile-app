import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useStripe, usePaymentSheet } from '@stripe/stripe-react-native';
import { useAuth } from '../context/AuthContext';
import Button from './Button';

const ORANGE_COLOR = '#FF9500';

const StripePaymentSheet = ({ 
  amount, 
  currency = 'gbp', 
  description,
  customerId,
  onPaymentSuccess,
  onPaymentError,
  onCancel,
  buttonTitle = "Pay Now",
  style 
}) => {
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const { axiosInstance, getAccessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentSheetReady, setPaymentSheetReady] = useState(false);

  const initializePaymentSheet = async () => {
    try {
      setLoading(true);
      
      // Create payment intent on your backend
      const response = await axiosInstance.post('/billing/create-payment-intent/', {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency,
        description: description,
        customer_id: customerId,
      });

      const { client_secret, customer, ephemeral_key } = response.data;

      const { error } = await initPaymentSheet({
        merchantDisplayName: 'WrapBattz',
        customerId: customer,
        customerEphemeralKeySecret: ephemeral_key,
        paymentIntentClientSecret: client_secret,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: 'Your Customer',
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

      if (!error) {
        setPaymentSheetReady(true);
      } else {
        console.error('PaymentSheet initialization error:', error);
        onPaymentError && onPaymentError(error);
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      onPaymentError && onPaymentError(error);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentSheet = async () => {
    if (!paymentSheetReady) {
      await initializePaymentSheet();
      return;
    }

    const { error } = await presentPaymentSheet();

    if (error) {
      if (error.code === 'Canceled') {
        onCancel && onCancel();
      } else {
        Alert.alert('Payment Error', error.message);
        onPaymentError && onPaymentError(error);
      }
    } else {
      Alert.alert('Success', 'Your payment was confirmed!');
      onPaymentSuccess && onPaymentSuccess();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Button
        title={loading ? 'Preparing...' : buttonTitle}
        onPress={openPaymentSheet}
        disabled={loading}
        style={styles.payButton}
        icon={loading ? <ActivityIndicator size="small" color="white" /> : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  payButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
  },
});

export default StripePaymentSheet;