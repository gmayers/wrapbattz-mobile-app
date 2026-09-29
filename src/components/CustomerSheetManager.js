import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CustomerSheet } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { billingErrorMessage, isBillingForbidden } from '../api/billingErrors';
import { createCustomerSheet, setDefaultPaymentMethod } from '../api/endpoints/billing';
import Button from './Button';
import { STRIPE_CONFIG } from '../config/stripe';

const ORANGE_COLOR = '#FFC72C';

/**
 * Manages saved cards through Stripe's CustomerSheet.
 *
 * There is no "list payment methods" endpoint — the API exposes only
 * POST /billing/customer-sheet/ (session values) and
 * POST /billing/payment-method/default/ (persist a choice). So the card on
 * file is not fetched on mount: the server tells us *whether* one exists via
 * BillingState.actions.needs_payment_method, and the card's actual details
 * only become known once the user opens the sheet. Both endpoints are
 * owner-only, so a non-owner gets a clear message rather than a dead button.
 */
const CustomerSheetManager = ({
  hasPaymentMethodOnFile = false,
  onPaymentMethodSelected,
  onError,
  style
}) => {
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const openCustomerSheet = async () => {
    try {
      setLoading(true);
      setInitializing(true);

      const session = await createCustomerSheet();

      if (!session.customer_id || !session.ephemeral_key_secret) {
        throw new Error('Invalid customer session response from server. Please try again or contact support.');
      }

      const initResult = await CustomerSheet.initialize({
        customerId: session.customer_id,
        customerEphemeralKeySecret: session.ephemeral_key_secret,
        setupIntentClientSecret: session.setup_intent_client_secret,
        merchantDisplayName: 'ToolTraq',
        returnURL: `${STRIPE_CONFIG.urlScheme}://stripe-redirect`,
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

      const { error, paymentMethod } = await CustomerSheet.present();

      if (error) {
        if (error.code === 'Canceled') return;
        throw new Error(error.message || 'An error occurred while managing payment methods');
      }

      if (!paymentMethod) return;

      setSelectedCard(paymentMethod.Card ?? null);

      // The sheet only attaches the card to the customer; making it the one
      // we bill against is a separate server call.
      await setDefaultPaymentMethod({ payment_method_id: paymentMethod.id });

      Alert.alert('Success', 'Payment method updated successfully', [{ text: 'OK' }]);
      onPaymentMethodSelected && onPaymentMethodSelected(paymentMethod);
    } catch (error) {
      const title = isBillingForbidden(error) ? 'Access Denied' : 'Payment Setup Error';
      Alert.alert(
        title,
        billingErrorMessage(error, 'Failed to open payment methods. Please try again.')
      );
      onError && onError(error);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  const renderCurrentPaymentMethod = () => {
    if (initializing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading payment methods...</Text>
        </View>
      );
    }

    // Before the sheet is opened we know only whether a card exists, not which.
    if (!selectedCard) {
      return (
        <Text style={styles.noPaymentText}>
          {hasPaymentMethodOnFile ? 'Card on file' : 'No payment method on file'}
        </Text>
      );
    }

    const brand = selectedCard.brand || 'Card';
    const last4 = selectedCard.last4 || '****';
    const expMonth = selectedCard.expMonth;
    const expYear = selectedCard.expYear;

    return (
      <View style={styles.paymentMethodRow}>
        <Ionicons name="card" size={24} color={ORANGE_COLOR} style={styles.cardIcon} />
        <View style={styles.cardDetails}>
          <Text style={styles.cardBrand}>
            {brand.charAt(0).toUpperCase() + brand.slice(1)}
          </Text>
          <Text style={styles.cardNumber}>•••• {last4}</Text>
          {expMonth && expYear && (
            <Text style={styles.cardExpiry}>
              Expires {String(expMonth).padStart(2, '0')}/{String(expYear).slice(-2)}
            </Text>
          )}
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        </View>
      </View>
    );
  };

  const hasCard = selectedCard != null || hasPaymentMethodOnFile;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment Methods</Text>
        {(loading || initializing) && <ActivityIndicator size="small" color={ORANGE_COLOR} />}
      </View>

      <View style={styles.paymentMethodContainer}>
        {renderCurrentPaymentMethod()}
      </View>

      <Button
        title={hasCard ? 'Manage Payment Methods' : 'Add Payment Method'}
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
