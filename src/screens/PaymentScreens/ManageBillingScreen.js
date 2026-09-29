// ManageBillingScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import CustomerSheetManager from '../../components/CustomerSheetManager';
import { billingErrorMessage, isBillingUnavailable } from '../../api/billingErrors';
import {
  cancelSubscription,
  getBillingState,
  getInvoices,
  getPlans,
  getSubscription,
  openPortal,
  resumeSubscription,
} from '../../api/endpoints/billing';
import { Linking } from 'react-native';

// TOOLTRAQ yellow color to match existing UI
const ORANGE_COLOR = '#FFC72C';

// Every money field on the billing API is an integer in minor units.
const formatCurrency = (minorUnits, currency = 'GBP') => {
  const amount = typeof minorUnits === 'number' ? minorUnits / 100 : 0;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
};

const STATUS_COLORS = {
  active: '#4CAF50',
  trial: '#2196F3',
  grace: '#FF9800',
  past_due: '#FF9800',
  canceled: '#FF9800',
  incomplete: '#F44336',
  none: '#9E9E9E',
};

// Statuses that mean the org has a real, usable subscription to manage.
const MANAGEABLE = new Set(['active', 'trial', 'past_due', 'grace']);

const ManageBillingScreen = ({ navigation }) => {
  const { isAdminOrOwner } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isAdminOrOwner) {
      Alert.alert(
        'Access Denied',
        'Only organization admins and owners can manage billing.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isAdminOrOwner, navigation]);

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [plan, setPlan] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);
  // Set only when the subscription was bought through Apple/Google, which
  // means the Stripe controls below must be replaced by a store deep link.
  const [iapSourcedState, setIapSourcedState] = useState(null);

  // Each call is independent: invoices and plans are decoration, so a failure
  // there must not blank out the billing state the screen is actually about.
  const fetchBillingData = useCallback(async () => {
    setLoading(true);

    const [stateResult, invoicesResult, plansResult, subscriptionResult] =
      await Promise.allSettled([
        getBillingState(),
        getInvoices(),
        getPlans(),
        getSubscription(),
      ]);

    if (stateResult.status === 'fulfilled') {
      setState(stateResult.value);
    } else {
      setState(null);
      if (!isBillingUnavailable(stateResult.reason)) {
        Alert.alert('Error', billingErrorMessage(stateResult.reason, 'Unable to load billing.'));
      }
    }

    setInvoices(invoicesResult.status === 'fulfilled' ? invoicesResult.value : []);

    // Match the org's tier against the plan catalogue to price the summary;
    // BillingState carries allowances, not amounts.
    if (plansResult.status === 'fulfilled' && stateResult.status === 'fulfilled') {
      const tier = stateResult.value?.tier;
      setPlan(plansResult.value.plans.find((p) => p.slug === tier) ?? null);
    } else {
      setPlan(null);
    }

    if (subscriptionResult.status === 'fulfilled') {
      const sub = subscriptionResult.value;
      setIapSourcedState(
        sub?.source === 'apple_iap' || sub?.source === 'google_iap' ? sub : null
      );
    } else {
      setIapSourcedState(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleOpenPortal = async () => {
    setProcessingAction(true);
    try {
      const { url } = await openPortal();
      if (!url) throw new Error('No portal URL returned');

      const result = await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: ORANGE_COLOR,
      });

      // The portal can change the plan or payment method, so re-read state
      // once the user comes back rather than trusting what's on screen.
      if (result.type === 'dismiss' || result.type === 'cancel') {
        await fetchBillingData();
      }
    } catch (error) {
      Alert.alert(
        'Error',
        billingErrorMessage(error, 'Unable to open the billing portal. Please try again later.')
      );
    } finally {
      setProcessingAction(false);
    }
  };

  // Plan changes go through Stripe's portal when there's a customer to bill,
  // and through Stripe checkout on DataHandlingFee when there isn't one yet.
  // ('Subscribe' is the Apple/Google IAP screen — a dead end for Stripe.)
  const handleChangePlan = () => {
    if (state?.actions?.can_open_portal) {
      handleOpenPortal();
      return;
    }
    navigation.navigate('DataHandlingFee');
  };

  const handleCancelSubscription = () => {
    if (state?.cancel_at_period_end) {
      Alert.alert(
        'Subscription Already Cancelled',
        `Your subscription is already cancelled and will end on ${formatDate(state?.current_period_end)}.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setProcessingAction(true);
            try {
              // The endpoint answers with the refreshed state, so there's no
              // need for a follow-up read.
              setState(await cancelSubscription());
              Alert.alert(
                'Subscription Cancelled',
                'Your subscription has been cancelled. It will remain active until the end of your current billing period.'
              );
            } catch (error) {
              Alert.alert(
                'Error',
                billingErrorMessage(error, 'Unable to cancel subscription. Please try again later.')
              );
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ]
    );
  };

  const handleReactivateSubscription = () => {
    if (!state?.cancel_at_period_end) {
      Alert.alert('Subscription Active', 'Your subscription is already active.', [{ text: 'OK' }]);
      return;
    }

    Alert.alert(
      'Reactivate Subscription',
      'Would you like to reactivate your subscription? It will continue after the current billing period.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            setProcessingAction(true);
            try {
              setState(await resumeSubscription());
              Alert.alert(
                'Subscription Reactivated',
                'Your subscription has been reactivated and will continue automatically.'
              );
            } catch (error) {
              Alert.alert(
                'Error',
                billingErrorMessage(error, 'Unable to reactivate subscription. Please try again later.')
              );
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading billing information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = state?.status ?? 'none';
  const hasSubscription = state !== null && MANAGEABLE.has(status);

  if (!hasSubscription) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.noBillingContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#888" />
          <Text style={[styles.noBillingText, { color: colors.textPrimary }]}>
            {state === null ? 'Billing not set up yet' : "You don't have an active billing plan"}
          </Text>
          <Text style={[styles.noBillingSubtext, { color: colors.textSecondary }]}>
            {state === null
              ? 'Contact your administrator or set up billing to get started'
              : 'Set up a billing plan to continue using premium features'}
          </Text>
          <TouchableOpacity
            style={[styles.activateButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('DataHandlingFee')}
          >
            <Text style={styles.activateButtonText}>Set Up Billing</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Apple and Google both require subscription management to happen in their
  // own surfaces, so the Stripe controls below don't apply to IAP purchases.
  if (iapSourcedState) {
    const url = iapSourcedState.source === 'apple_iap'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    const store = iapSourcedState.source === 'apple_iap' ? 'the App Store' : 'Google Play';
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Manage Billing</Text>
        </View>
        <View style={{ padding: 24, gap: 12 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
            Managed via {store}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
            Your subscription was purchased on this platform. To change plan,
            update payment method, or cancel, please use {store}'s own
            subscription management.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 }}
            onPress={() => Linking.openURL(url)}
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>Open {store}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const interval = state.billing_interval ?? 'monthly';
  const planName = plan?.name ?? state.tier ?? 'Device Management';
  const devices = state.limits?.devices ?? { included: 0, addon: 0, limit: 0, used: 0, remaining: 0 };
  const seats = state.limits?.seats ?? { included: 0, addon: 0, limit: 0, used: 0, remaining: 0 };
  const planPrice = interval === 'annual' ? plan?.annual_price : plan?.monthly_price;
  const currency = plan?.currency ?? 'GBP';
  const cancelAtPeriodEnd = state.cancel_at_period_end;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Manage Billing</Text>
          <Text style={styles.headerSubtitle}>
            {`${interval.charAt(0).toUpperCase() + interval.slice(1)} Plan - ${planName}`}
          </Text>
        </View>

        <View style={styles.billingCard}>
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] ?? '#F44336' }]}>
              <Text style={styles.statusBadgeText}>{status.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Plan:</Text>
            <Text style={styles.billingCardValue}>
              {interval.charAt(0).toUpperCase() + interval.slice(1)}
            </Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Pricing Tier:</Text>
            <Text style={styles.billingCardValue}>{planName}</Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Devices:</Text>
            <Text style={styles.billingCardValue}>{`${devices.used} / ${devices.limit}`}</Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Seats:</Text>
            <Text style={styles.billingCardValue}>{`${seats.used} / ${seats.limit}`}</Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Credits:</Text>
            <Text style={styles.billingCardValue}>{state.credits?.balance ?? 0}</Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>
              {status === 'trial' ? 'Trial Ends:' : 'Next Billing:'}
            </Text>
            <Text style={styles.billingCardValue}>
              {formatDate(status === 'trial' ? state.trial_ends_at : state.current_period_end)}
            </Text>
          </View>

          {state.in_grace_period && (
            <View style={styles.billingCardRow}>
              <Text style={styles.billingCardLabel}>Grace Ends:</Text>
              <Text style={styles.billingCardValue}>{formatDate(state.grace_ends_at)}</Text>
            </View>
          )}

          <View style={styles.feesContainer}>
            <Text style={styles.feesTitle}>Plan Allowances</Text>
            <View style={styles.feesRow}>
              <Text style={styles.feesDescription}>
                Included ({devices.included} devices, {seats.included} seats)
              </Text>
              <Text style={styles.feesAmount}>
                {planPrice != null ? formatCurrency(planPrice, currency) : '—'}
              </Text>
            </View>
            {(devices.addon > 0 || seats.addon > 0) && (
              <View style={styles.feesRow}>
                <Text style={styles.feesDescription}>
                  Add-ons ({devices.addon} devices, {seats.addon} seats)
                </Text>
                <Text style={styles.feesAmount}>Billed separately</Text>
              </View>
            )}
            <View style={styles.feesDivider} />
            <View style={styles.feesRow}>
              <Text style={styles.feesTotalLabel}>
                {interval === 'monthly' ? 'Monthly' : 'Annual'} Plan Fee
              </Text>
              <Text style={styles.feesTotal}>
                {planPrice != null ? formatCurrency(planPrice, currency) : '—'}
              </Text>
            </View>

            {interval === 'monthly' && plan?.annual_price != null && (
              <View style={styles.savingsNote}>
                <Text style={styles.savingsNoteText}>
                  Switch to annual billing and save on your subscription.
                </Text>
              </View>
            )}
          </View>
        </View>

        <CustomerSheetManager
          hasPaymentMethodOnFile={state.actions?.needs_payment_method === false}
          onPaymentMethodSelected={() => {
            fetchBillingData();
          }}
          onError={(error) => {
            console.error('Payment method error:', error);
          }}
        />

        {invoices.length > 0 && (
          <View style={styles.invoicesSection}>
            <Text style={styles.invoicesSectionTitle}>Recent Invoices</Text>
            {invoices.map((invoice) => (
              <TouchableOpacity
                key={invoice.id}
                style={styles.invoiceCard}
                onPress={async () => {
                  const invoiceUrl = invoice.hosted_invoice_url || invoice.pdf_url;
                  if (!invoiceUrl) {
                    Alert.alert(
                      'Invoice Unavailable',
                      'This invoice is not yet available. Please try again later.',
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  try {
                    await WebBrowser.openBrowserAsync(invoiceUrl, {
                      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                      controlsColor: ORANGE_COLOR,
                    });
                  } catch (error) {
                    Alert.alert('Error', 'Unable to open invoice. Please try again.', [{ text: 'OK' }]);
                  }
                }}
              >
                <View style={styles.invoiceCardHeader}>
                  <Text style={styles.invoiceCardDate}>{formatDate(invoice.created_at)}</Text>
                  <View style={[
                    styles.invoiceStatusBadge,
                    { backgroundColor: invoice.status === 'paid' ? '#4CAF50' : '#F44336' }
                  ]}>
                    <Text style={styles.invoiceStatusBadgeText}>
                      {(invoice.status || 'unknown').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.invoiceCardBody}>
                  <Text style={styles.invoiceCardAmount}>{formatCurrency(invoice.amount, currency)}</Text>
                  <Text style={styles.invoiceCardPeriod}>
                    {invoice.number ? `Invoice ${invoice.number}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.actionsContainer}>
          {state.actions?.can_open_portal && (
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { width: '100%' }, processingAction && styles.disabledButton]}
                onPress={handleOpenPortal}
                disabled={processingAction}
              >
                <Ionicons name="card-outline" size={20} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Billing Portal</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { width: '100%' }, processingAction && styles.disabledButton]}
              onPress={handleChangePlan}
              disabled={processingAction}
            >
              <Ionicons name="repeat" size={20} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Change Plan</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.secondaryActions}>
            {cancelAtPeriodEnd ? (
              <TouchableOpacity
                style={[styles.reactivateButton, processingAction && styles.disabledButton]}
                onPress={handleReactivateSubscription}
                disabled={processingAction}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                <Text style={styles.reactivateButtonText}>Reactivate Plan</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.cancelButton, processingAction && styles.disabledButton]}
                onPress={handleCancelSubscription}
                disabled={processingAction}
              >
                <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                <Text style={[styles.cancelButtonText, { color: '#EF4444' }]}>Cancel Plan</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.portalDescription}>
            Your device count is automatically managed based on the devices in your organization.
            {` ${devices.included} devices are included in your plan at no extra cost.`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
},
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
},
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF'
},
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
},
  headerSubtitle: {
    fontSize: 16,
    color: '#666'
},
  billingCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE'
},
  billingCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
},
  billingCardLabel: {
    fontSize: 16,
    color: '#555'
},
  billingCardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
},
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4
},
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
},
feesContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
},
  feesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10
},
  feesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
},
  feesDescription: {
    fontSize: 14,
    color: '#555',
    flex: 3
},
  feesAmount: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right'
},
  feesDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8
},
  feesTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
},
  feesTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
},
  savingsNote: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107'
},
  savingsNoteText: {
    fontSize: 14,
    color: '#F57C00'
},
  invoicesSection: {
    margin: 20,
    marginTop: 0
},
  invoicesSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12
},
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    marginBottom: 12
},
  invoiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE'
},
  invoiceCardDate: {
    fontSize: 14,
    color: '#666'
},
  invoiceStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4
},
  invoiceStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
},
  invoiceCardBody: {
    padding: 12
},
  invoiceCardAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
},
  invoiceCardPeriod: {
    fontSize: 13,
    color: '#777'
},
  actionsContainer: {
    margin: 20,
    marginTop: 10
},
  portalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE_COLOR,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12
},
  buttonIcon: {
    marginRight: 8
},
  portalButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600'
},
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
},
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    width: '48%',
    justifyContent: 'center'
},
  secondaryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: ORANGE_COLOR
},
  reactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 8,
    width: '100%',
    backgroundColor: '#F1F8F4'
},
  reactivateButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50'
},
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 8,
    width: '100%',
    backgroundColor: '#FFF5F5'
},
  cancelButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444'
},
  portalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20
},
  noBillingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
},
  noBillingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12
},
  noBillingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
    lineHeight: 20
},
  activateButton: {
    backgroundColor: ORANGE_COLOR,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8
},
  activateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600'
},
  disabledButton: {
    opacity: 0.6
}
});

export default ManageBillingScreen;