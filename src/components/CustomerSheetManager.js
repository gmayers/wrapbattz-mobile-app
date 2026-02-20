import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CustomerSheet } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { billingService } from '../services/BillingService';
import Button from './Button';

const ORANGE_COLOR = '#FF9500';

/**
 * CustomerSheetManager - Manages payment methods using Stripe CustomerSheet
 *
 * This component provides a UI for users to:
 * - View their current default payment method
 * - Add new payment methods via CustomerSheet
 * - Manage (add/remove/edit) payment methods
 *
 * Uses CustomerSheet API for managing saved payment methods.
 * Backend provides customer session credentials via /subscriptions/api/customer-session/
 */
const CustomerSheetManager = ({
  customerId,
  onPaymentMethodSelected,
  onError,
  style
}) => {
  const { axiosInstance } = useAuth();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  // Fetch current payment methods from API
  // notifyParent: only true after user interaction (e.g. openCustomerSheet),
  // false on initial mount to avoid triggering a re-render loop
  const fetchPaymentMethods = async (notifyParent = false) => {
    try {
      const methods = await billingService.getPaymentMethods();

      // Find the default payment method
      const defaultMethod = methods.find(m => m.is_default);

      if (defaultMethod) {
        setSelectedPaymentMethod(defaultMethod);
        if (notifyParent) {
          onPaymentMethodSelected && onPaymentMethodSelected(defaultMethod);
        }
      } else if (methods.length > 0) {
        // If no default but methods exist, use the first one
        setSelectedPaymentMethod(methods[0]);
        if (notifyParent) {
          onPaymentMethodSelected && onPaymentMethodSelected(methods[0]);
        }
      } else {
        setSelectedPaymentMethod(null);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      // Don't alert here - this might be first time setup
      setSelectedPaymentMethod(null);
    }
  };

  // Initialize and present CustomerSheet
  const openCustomerSheet = async () => {
    try {
      setLoading(true);
      setInitializing(true);

      // Fetch customer session from backend
      const sessionData = await billingService.createCustomerSession();

      // Validate response
      if (!sessionData.customer_id || !sessionData.ephemeral_key_secret) {
        throw new Error('Invalid customer session response from server. Please try again or contact support.');
      }

      // Initialize CustomerSheet
      const initResult = await CustomerSheet.initialize({
        customerId: sessionData.customer_id,
        customerEphemeralKeySecret: sessionData.ephemeral_key_secret,
        setupIntentClientSecret: sessionData.setup_intent_client_secret,
        merchantDisplayName: 'WrapBattz',
        returnURL: 'wrapbattz://stripe-redirect',
        allowsRemovalOfLastSavedPaymentMethod: false,
        defaultBillingDetails: {},
        style: 'alwaysLight',
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

      if (initResult.error) {
        throw new Error(`CustomerSheet initialization error: ${initResult.error.message}`);
      }

      setInitializing(false);

      // Present the CustomerSheet
      const { error, paymentOption } = await CustomerSheet.present();

      if (error) {
        if (error.code === 'Canceled') {
          // User canceled - no action needed
          console.log('CustomerSheet canceled by user');
          return;
        }
        throw new Error(error.message || 'An error occurred while managing payment methods');
      }

      // Success! Payment method was updated
      if (paymentOption) {
        Alert.alert(
          'Success',
          'Payment method updated successfully',
          [{ text: 'OK' }]
        );
      }

      // Refresh payment methods list and notify parent since user took action
      await fetchPaymentMethods(true);

    } catch (error) {
      console.error('Error with CustomerSheet:', error);

      // Provide user-friendly error messages based on error type
      let errorTitle = 'Payment Setup Error';
      let errorMessage = 'Failed to open payment methods. Please try again.';

      if (error.response) {
        // API error
        const status = error.response.status;
        const detail = error.response.data?.detail || error.response.data?.error;

        if (status === 404) {
          errorTitle = 'Setup Not Available';
          errorMessage = 'Customer session service is not available. Please contact support.';
        } else if (status === 500) {
          errorTitle = 'Server Error';
          errorMessage = detail || 'A server error occurred. This usually happens when billing is not fully configured. Please contact support.';
        } else if (status === 403) {
          errorTitle = 'Access Denied';
          errorMessage = 'You don\'t have permission to manage payment methods. Please contact your organization administrator.';
        } else if (status === 400) {
          errorTitle = 'Invalid Request';
          errorMessage = detail || 'Invalid customer session request. Please try again.';
        } else if (detail) {
          errorMessage = detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(errorTitle, errorMessage);
      onError && onError(error);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  // Fetch payment methods on mount
  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  // Render current payment method
  const renderCurrentPaymentMethod = () => {
    if (initializing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading payment methods...</Text>
        </View>
      );
    }

    if (!selectedPaymentMethod) {
      return (
        <Text style={styles.noPaymentText}>
          No payment method on file
        </Text>
      );
    }

    // Card details from API response
    const brand = selectedPaymentMethod.brand || selectedPaymentMethod.card?.brand || 'Card';
    const last4 = selectedPaymentMethod.last4 || selectedPaymentMethod.card?.last4 || '****';
    const expMonth = selectedPaymentMethod.exp_month || selectedPaymentMethod.card?.exp_month;
    const expYear = selectedPaymentMethod.exp_year || selectedPaymentMethod.card?.exp_year;

    // Get appropriate icon based on card brand
    const getCardIcon = (cardBrand) => {
      const brandLower = cardBrand?.toLowerCase() || '';
      if (brandLower.includes('visa')) return 'card';
      if (brandLower.includes('mastercard')) return 'card';
      if (brandLower.includes('amex')) return 'card';
      if (brandLower.includes('discover')) return 'card';
      return 'card-outline';
    };

    return (
      <View style={styles.paymentMethodRow}>
        <Ionicons
          name={getCardIcon(brand)}
          size={24}
          color={ORANGE_COLOR}
          style={styles.cardIcon}
        />
        <View style={styles.cardDetails}>
          <Text style={styles.cardBrand}>
            {brand.charAt(0).toUpperCase() + brand.slice(1)}
          </Text>
          <Text style={styles.cardNumber}>
            •••• {last4}
          </Text>
          {expMonth && expYear && (
            <Text style={styles.cardExpiry}>
              Expires {String(expMonth).padStart(2, '0')}/{String(expYear).slice(-2)}
            </Text>
          )}
          {selectedPaymentMethod.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment Methods</Text>
        {(loading || initializing) && (
          <ActivityIndicator size="small" color={ORANGE_COLOR} />
        )}
      </View>

      <View style={styles.paymentMethodContainer}>
        {renderCurrentPaymentMethod()}
      </View>

      <Button
        title={selectedPaymentMethod ? "Manage Payment Methods" : "Add Payment Method"}
        onPress={openCustomerSheet}
        disabled={loading || initializing}
        style={styles.manageButton}
        leftIcon={<Ionicons name="card-outline" size={20} color="black" />}
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  defaultBadge: {
    backgroundColor: ORANGE_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
});

export default CustomerSheetManager;
