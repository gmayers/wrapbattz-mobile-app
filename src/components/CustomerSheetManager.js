import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CustomerSheetBeta } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import Button from './Button';

const ORANGE_COLOR = '#FF9500';

const CustomerSheetManager = ({ 
  customerId,
  onPaymentMethodSelected,
  onError,
  style 
}) => {
  const { axiosInstance } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customerSheetVisible, setCustomerSheetVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [sheetInitialized, setSheetInitialized] = useState(false);
  const [setupIntentSecret, setSetupIntentSecret] = useState('');
  const [ephemeralKeySecret, setEphemeralKeySecret] = useState('');

  // Initialize Customer Sheet
  const initializeCustomerSheet = async () => {
    try {
      setLoading(true);

      // Fetch ephemeral key and setup intent from backend
      const [ephemeralResponse, setupIntentResponse] = await Promise.all([
        axiosInstance.post('/billing/customer-ephemeral-key/', {
          customer_id: customerId,
        }),
        axiosInstance.post('/billing/create-setup-intent/', {
          customer_id: customerId,
        })
      ]);

      setEphemeralKeySecret(ephemeralResponse.data.ephemeral_key_secret);
      setSetupIntentSecret(setupIntentResponse.data.setup_intent_client_secret);

      // Initialize the Customer Sheet
      const { error } = await CustomerSheetBeta.initialize({
        setupIntentClientSecret: setupIntentResponse.data.setup_intent_client_secret,
        customerEphemeralKeySecret: ephemeralResponse.data.ephemeral_key_secret,
        customerId: customerId,
        headerTextForSelectionScreen: 'Manage your payment methods',
        returnURL: 'wrapbattz://stripe-redirect',
        defaultBillingDetails: {
          email: ephemeralResponse.data.customer_email || '',
        },
        billingDetailsCollectionConfiguration: {
          name: 'always',
          email: 'never', // We already have it
          phone: 'automatic',
          address: 'automatic',
          attachDefaultsToPaymentMethod: true,
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
            icon: ORANGE_COLOR,
          },
          shapes: {
            borderRadius: 8,
            borderWidth: 1,
          },
        },
      });

      if (error) {
        throw new Error(`CustomerSheet initialization error: ${error.message}`);
      }

      setSheetInitialized(true);

      // Retrieve the current selection
      await retrieveCurrentSelection();

    } catch (error) {
      console.error('CustomerSheet initialization error:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to initialize payment methods. Please try again.'
      );
      onError && onError(error);
    } finally {
      setLoading(false);
    }
  };

  // Retrieve current payment method selection
  const retrieveCurrentSelection = async () => {
    try {
      const { error, paymentOption, paymentMethod } = 
        await CustomerSheetBeta.retrievePaymentOptionSelection();

      if (!error && paymentMethod) {
        setSelectedPaymentMethod(paymentMethod);
        onPaymentMethodSelected && onPaymentMethodSelected(paymentMethod);
      }
    } catch (error) {
      console.error('Error retrieving payment selection:', error);
    }
  };

  // Open the Customer Sheet
  const openCustomerSheet = async () => {
    if (!sheetInitialized) {
      await initializeCustomerSheet();
    }
    setCustomerSheetVisible(true);
  };

  // Handle Customer Sheet result
  const handleCustomerSheetResult = ({ error, paymentOption, paymentMethod }) => {
    setCustomerSheetVisible(false);

    if (error) {
      if (error.code === 'Canceled') {
        // User canceled - no action needed
        return;
      }
      Alert.alert('Error', error.message || 'An error occurred');
      onError && onError(error);
      return;
    }

    if (paymentMethod) {
      setSelectedPaymentMethod(paymentMethod);
      onPaymentMethodSelected && onPaymentMethodSelected(paymentMethod);
      
      // Update default payment method on backend
      axiosInstance.post('/billing/set-default-payment-method/', {
        payment_method_id: paymentMethod.id,
        customer_id: customerId,
      }).catch(err => {
        console.error('Error setting default payment method:', err);
      });
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (customerId) {
      initializeCustomerSheet();
    }
  }, [customerId]);

  // Render current payment method
  const renderCurrentPaymentMethod = () => {
    if (!selectedPaymentMethod) {
      return (
        <Text style={styles.noPaymentText}>
          No payment method on file
        </Text>
      );
    }

    const { card } = selectedPaymentMethod;
    if (card) {
      return (
        <View style={styles.paymentMethodRow}>
          <Ionicons 
            name="card-outline" 
            size={24} 
            color={ORANGE_COLOR} 
            style={styles.cardIcon}
          />
          <View style={styles.cardDetails}>
            <Text style={styles.cardBrand}>
              {card.brand.charAt(0).toUpperCase() + card.brand.slice(1)}
            </Text>
            <Text style={styles.cardNumber}>
              •••• {card.last4}
            </Text>
            <Text style={styles.cardExpiry}>
              Expires {card.expMonth}/{card.expYear}
            </Text>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment Methods</Text>
        {loading && <ActivityIndicator size="small" color={ORANGE_COLOR} />}
      </View>

      <View style={styles.paymentMethodContainer}>
        {renderCurrentPaymentMethod()}
      </View>

      <Button
        title="Manage Payment Methods"
        onPress={openCustomerSheet}
        disabled={loading}
        style={styles.manageButton}
        icon={<Ionicons name="card-outline" size={20} color="white" />}
      />

      {sheetInitialized && (
        <CustomerSheetBeta.CustomerSheet
          visible={customerSheetVisible}
          setupIntentClientSecret={setupIntentSecret}
          customerEphemeralKeySecret={ephemeralKeySecret}
          customerId={customerId}
          headerTextForSelectionScreen="Manage your payment methods"
          returnURL="wrapbattz://stripe-redirect"
          onResult={handleCustomerSheetResult}
        />
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentMethodContainer: {
    marginBottom: 16,
    minHeight: 60,
    justifyContent: 'center',
  },
  noPaymentText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cardIcon: {
    marginRight: 12,
  },
  cardDetails: {
    flex: 1,
  },
  cardBrand: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cardNumber: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cardExpiry: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  manageButton: {
    backgroundColor: ORANGE_COLOR,
    borderColor: ORANGE_COLOR,
  },
});

export default CustomerSheetManager;