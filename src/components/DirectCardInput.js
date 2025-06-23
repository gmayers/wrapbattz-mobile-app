import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { useAuth } from '../context/AuthContext';
import Button from './Button';

const ORANGE_COLOR = '#FF9500';

const DirectCardInput = ({ 
  onPaymentMethodCreated,
  onError,
  customerId,
  style 
}) => {
  const { createPaymentMethod } = useStripe();
  const { axiosInstance } = useAuth();
  const [cardDetails, setCardDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePaymentMethodCreation = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Incomplete Card', 'Please enter complete card details.');
      return;
    }

    try {
      setLoading(true);

      // Create payment method
      const { error, paymentMethod } = await createPaymentMethod({
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {
            name: 'WrapBattz Customer',
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Attach payment method to customer via backend
      await axiosInstance.post('/billing/attach-payment-method/', {
        payment_method_id: paymentMethod.id,
        customer_id: customerId,
      });

      Alert.alert(
        'Payment Method Added', 
        'Your card has been successfully added and saved.'
      );

      onPaymentMethodCreated && onPaymentMethodCreated(paymentMethod);

    } catch (error) {
      console.error('Payment method creation error:', error);
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
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Add Payment Method</Text>
      <Text style={styles.description}>
        Enter your card details to set up payment for your subscription.
      </Text>
      
      <CardField
        postalCodeEnabled={true}
        placeholders={{
          number: '4242 4242 4242 4242',
        }}
        cardStyle={{
          backgroundColor: '#FFFFFF',
          textColor: '#000000',
          borderColor: '#e3e3e3',
          borderWidth: 1,
          borderRadius: 8,
          fontSize: 16,
          placeholderColor: '#a8a8a8',
        }}
        style={styles.cardField}
        onCardChange={(details) => {
          setCardDetails(details);
        }}
      />

      <Button
        title={loading ? 'Adding Card...' : 'Add Card'}
        onPress={handlePaymentMethodCreation}
        disabled={loading || !cardDetails?.complete}
        style={[
          styles.addButton,
          (!cardDetails?.complete) && styles.disabledButton
        ]}
      />

      <Text style={styles.securityNote}>
        🔒 Your card information is secured by Stripe and encrypted during transmission.
      </Text>
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
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 16,
  },
  addButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    borderColor: '#ccc',
  },
  securityNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

export default DirectCardInput;