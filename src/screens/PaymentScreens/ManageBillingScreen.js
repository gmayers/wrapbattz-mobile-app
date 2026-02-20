// ManageBillingScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../context/AuthContext';
import CustomModal from '../../components/Modal';
import CustomerSheetManager from '../../components/CustomerSheetManager';
import { billingService } from '../../services/BillingService';

// Orange color to match existing UI
const ORANGE_COLOR = '#FF9500';

const ManageBillingScreen = ({ navigation }) => {
  const { isAdminOrOwner } = useAuth();

  // Check permissions
  React.useEffect(() => {
    if (!isAdminOrOwner) {
      Alert.alert(
        'Access Denied',
        'Only organization admins and owners can manage billing.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isAdminOrOwner, navigation]);

  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [processingAction, setProcessingAction] = useState(false);
  const [showDeviceCountModal, setShowDeviceCountModal] = useState(false);
  const [deviceCountInput, setDeviceCountInput] = useState('');
  
  const fetchBillingData = async () => {
    try {
      setLoading(true);
      // Fetch actual billing data using new service
      const [usageData, invoicesData] = await Promise.all([
        billingService.getUsage(),
        billingService.getInvoices()
      ]);

      setBillingData(usageData);
      setInvoices(invoicesData.results || invoicesData || []);
    } catch (error) {
      // Check if it's a 404 (no subscription/billing not set up yet)
      if (error.response?.status === 404) {
        console.log('ℹ️ No billing data found - user may not have a subscription yet');
        // Don't show error, just set empty state
        setBillingData(null);
        setInvoices([]);
        return;
      }

      // Check for network errors
      if (error.message === 'Network Error' || !error.response) {
        console.log('ℹ️ Network error fetching billing data (expected if backend not running)');
        setBillingData(null);
        setInvoices([]);
        return;
      }

      console.log('ℹ️ Billing data not available, trying fallback...');

      try {
        // Fallback to legacy endpoints
        const [billingResponse, invoicesResponse] = await Promise.all([
          billingService.getBillingStatus(),
          billingService.getInvoices()
        ]);

        setBillingData(billingResponse);
        setInvoices(invoicesResponse.results || invoicesResponse || []);
      } catch (fallbackError) {
        // Check if fallback also got 404 or network error
        if (fallbackError.response?.status === 404 ||
            error.response?.status === 404 ||
            fallbackError.message === 'Network Error' ||
            !fallbackError.response) {
          console.log('ℹ️ No billing data available - billing may not be set up yet');
          setBillingData(null);
          setInvoices([]);
          return;
        }

        // For 500 errors or other server errors, also show "not set up" state
        // because the billing backend may not be properly configured
        if (fallbackError.response?.status >= 500 || error.response?.status >= 500) {
          console.log('ℹ️ Server error - billing backend may not be configured');
          setBillingData(null);
          setInvoices([]);
          return;
        }

        // For any other errors, set to null to show "not set up" state
        console.log('ℹ️ Fallback endpoints also unavailable, showing setup screen');
        setBillingData(null);
        setInvoices([]);
      }
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchBillingData();
  }, []);
  
  const openBillingPortal = async () => {
    setProcessingAction(true);
    try {
      // Create a Stripe Customer Portal session using new service
      const response = await billingService.createCustomerPortalSession();

      if (response.url) {
        // Open the Stripe portal URL in native in-app browser
        // Uses Safari View Controller (iOS) or Chrome Custom Tabs (Android)
        const result = await WebBrowser.openBrowserAsync(response.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          controlsColor: ORANGE_COLOR,
        });

        // Refresh billing data after user closes the portal
        if (result.type === 'dismiss' || result.type === 'cancel') {
          await fetchBillingData();
        }
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);

      let errorMessage = 'Unable to open billing portal. Please try again later.';
      if (error.response?.status === 404) {
        errorMessage = 'Billing portal not available. Please contact support.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response) {
        errorMessage = `Server error (${error.response.status}). Please try again later.`;
      }

      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setProcessingAction(false);
    }
  };
  
  const handleChangePlan = () => {
    // Prerequisite check: Must have active subscription
    const status = billingData?.subscription_status || billingData?.subscription?.status;
    if (!status || !['active', 'past_due', 'trialing'].includes(status)) {
      Alert.alert(
        'No Active Subscription',
        'You need an active subscription to change plans. Would you like to set up billing now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set Up Billing',
            onPress: () => navigation.navigate('DataHandlingFee')
          }
        ]
      );
      return;
    }

    const currentCycle = billingData.billing_period || billingData.subscription?.cycle || 'monthly';
    const newCycle = currentCycle === 'monthly' ? 'annual' : 'monthly';
    const newPlanSlug = newCycle === 'annual' ? 'annual-device-billing' : 'monthly-device-billing';

    Alert.alert(
      'Change Billing Plan',
      `Would you like to switch to ${newCycle} billing?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change Plan',
          onPress: async () => {
            setProcessingAction(true);
            try {
              // Call API to change plan using new service
              await billingService.switchPlan({
                plan_slug: newPlanSlug,
                prorate: true
              });

              Alert.alert(
                'Plan Updated',
                `Your plan has been changed to ${newCycle} billing. The change will take effect on your next billing date.`
              );
              // Refresh billing data
              await fetchBillingData();
            } catch (error) {
              console.error('Error changing plan:', error);

              let errorMessage = 'Unable to change plan. Please try again later.';
              if (error.response?.status === 404) {
                errorMessage = 'No subscription found. Please set up billing first.';
              } else if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
              } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
              } else if (error.response) {
                errorMessage = `Server error (${error.response.status}). Please try again later.`;
              }

              Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
            } finally {
              setProcessingAction(false);
            }
          }
        }
      ]
    );
  };
  
  const handleCancelSubscription = () => {
    // Prerequisite check: Must have active subscription
    const status = billingData?.subscription_status || billingData?.subscription?.status;
    if (!status || status === 'inactive') {
      Alert.alert(
        'No Active Subscription',
        'You don\'t have an active subscription to cancel.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if already cancelled
    const cancelAtPeriodEnd = billingData?.cancel_at_period_end || billingData?.subscription?.cancel_at_period_end;
    if (status === 'cancelled' || cancelAtPeriodEnd) {
      Alert.alert(
        'Subscription Already Cancelled',
        'Your subscription is already cancelled and will end on ' +
          formatDate(billingData?.next_billing_date || billingData?.subscription?.current_period_end) + '.',
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
              // Call API to cancel subscription using new service
              await billingService.cancelSubscription({
                at_period_end: true
              });

              Alert.alert(
                'Subscription Cancelled',
                'Your subscription has been cancelled. It will remain active until the end of your current billing period.',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      // Refresh billing data
                      await fetchBillingData();
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error cancelling subscription:', error);

              let errorMessage = 'Unable to cancel subscription. Please try again later.';
              if (error.response?.status === 404) {
                errorMessage = 'No subscription found. Please contact support.';
              } else if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
              } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
              } else if (error.response) {
                errorMessage = `Server error (${error.response.status}). Please try again later.`;
              }

              Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
            } finally {
              setProcessingAction(false);
            }
          }
        }
      ]
    );
  };

  const handleReactivateSubscription = () => {
    // Check if subscription can be reactivated
    const cancelAtPeriodEnd = billingData?.cancel_at_period_end || billingData?.subscription?.cancel_at_period_end;
    if (!cancelAtPeriodEnd) {
      Alert.alert(
        'Subscription Active',
        'Your subscription is already active.',
        [{ text: 'OK' }]
      );
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
              await billingService.reactivateSubscription();

              Alert.alert(
                'Subscription Reactivated',
                'Your subscription has been reactivated and will continue automatically.',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await fetchBillingData();
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error reactivating subscription:', error);

              let errorMessage = 'Unable to reactivate subscription. Please try again later.';
              if (error.response?.data?.detail) {
                errorMessage = error.response.data.detail;
              }

              Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
            } finally {
              setProcessingAction(false);
            }
          }
        }
      ]
    );
  };

  const handleUpdateDeviceCount = () => {
    const status = billingData?.subscription_status || billingData?.subscription?.status;
    if (!status || status === 'inactive') {
      Alert.alert(
        'No Active Subscription',
        'You need an active subscription to update device count.',
        [{ text: 'OK' }]
      );
      return;
    }

    const currentCount = billingData?.current_device_count || 0;
    setDeviceCountInput(String(currentCount));
    setShowDeviceCountModal(true);
  };

  const submitDeviceCountUpdate = async () => {
    const newCount = parseInt(deviceCountInput);

    if (isNaN(newCount) || newCount < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number.', [{ text: 'OK' }]);
      return;
    }

    if (newCount < (billingData?.free_quota || 3)) {
      Alert.alert(
        'Invalid Count',
        `Device count cannot be less than the free tier (${billingData?.free_quota || 3} devices).`,
        [{ text: 'OK' }]
      );
      return;
    }

    setShowDeviceCountModal(false);
    setProcessingAction(true);
    try {
      await billingService.updateDeviceCount({ device_count: newCount });

      const billableDevices = Math.max(0, newCount - (billingData?.free_quota || 3));

      Alert.alert(
        'Device Count Updated',
        `Your device count has been updated to ${newCount} (${billableDevices} billable). Changes will be reflected in your next billing cycle.`,
        [{ text: 'OK', onPress: async () => await fetchBillingData() }]
      );
    } catch (error) {
      console.error('Error updating device count:', error);

      let errorMessage = 'Unable to update device count. Please try again later.';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response) {
        errorMessage = `Server error (${error.response.status}). Please try again later.`;
      }

      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setProcessingAction(false);
    }
  };

  const formatCurrency = (amount, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A';

    let date;
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (typeof dateInput === 'number') {
      // Handle both Unix timestamps (seconds) and JavaScript timestamps (milliseconds)
      date = new Date(dateInput < 10000000000 ? dateInput * 1000 : dateInput);
    } else {
      return 'N/A';
    }

    if (isNaN(date.getTime())) return 'N/A';

    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading billing information...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Check if user has billing data
  // Backend returns flat fields: subscription_status, billing_period, etc.
  const subscriptionStatus = billingData?.subscription_status || billingData?.subscription?.status;
  const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

  // If no billing data or not active, show setup screen
  if (!billingData || !isActive) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noBillingContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#888" />
          <Text style={styles.noBillingText}>
            {!billingData
              ? 'Billing not set up yet'
              : 'You don\'t have an active billing plan'}
          </Text>
          <Text style={styles.noBillingSubtext}>
            {!billingData
              ? 'Contact your administrator or set up billing to get started'
              : 'Set up a billing plan to continue using premium features'}
          </Text>
          <TouchableOpacity
            style={styles.activateButton}
            onPress={() => navigation.navigate('DataHandlingFee')}
          >
            <Text style={styles.activateButtonText}>Set Up Billing</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get values from flat fields or nested subscription object for backwards compatibility
  const billingPeriod = billingData?.billing_period || billingData?.subscription?.cycle || 'monthly';
  const planName = billingData?.plan_name || billingData?.subscription?.plan_name || 'Device Management';
  const freeDevices = billingData?.free_devices || billingData?.free_quota || 3;
  const deviceCount = billingData?.device_count || billingData?.current_device_count || 0;
  const billableDevices = billingData?.billable_devices || 0;
  const currentPrice = billingData?.current_price || billingData?.current_cost || 0;
  const cancelAtPeriodEnd = billingData?.cancel_at_period_end || billingData?.subscription?.cancel_at_period_end;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Billing</Text>
          <Text style={styles.headerSubtitle}>
            {`${billingPeriod.charAt(0).toUpperCase() + billingPeriod.slice(1)} Plan - ${planName}`}
          </Text>
        </View>

        <View style={styles.billingCard}>
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Status:</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor:
                subscriptionStatus === 'active' ? '#4CAF50' :
                subscriptionStatus === 'trialing' ? '#2196F3' :
                subscriptionStatus === 'cancelled' ? '#FF9800' :
                subscriptionStatus === 'past_due' ? '#FF9800' :
                '#F44336'
              }
            ]}>
              <Text style={styles.statusBadgeText}>
                {(subscriptionStatus || 'unknown').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Plan:</Text>
            <Text style={styles.billingCardValue}>
              {billingPeriod.charAt(0).toUpperCase() + billingPeriod.slice(1)}
            </Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Pricing Tier:</Text>
            <Text style={styles.billingCardValue}>{planName}</Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Free Devices:</Text>
            <Text style={styles.billingCardValue}>{freeDevices}</Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Total Devices:</Text>
            <Text style={styles.billingCardValue}>{deviceCount}</Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Billable Devices:</Text>
            <Text style={styles.billingCardValue}>{billableDevices}</Text>
          </View>

          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Next Billing:</Text>
            <Text style={styles.billingCardValue}>
              {formatDate(billingData?.next_billing_date)}
            </Text>
          </View>

          <View style={styles.feesContainer}>
            <Text style={styles.feesTitle}>Device Management Fees</Text>
            <View style={styles.feesRow}>
              <Text style={styles.feesDescription}>Free Tier ({freeDevices} devices)</Text>
              <Text style={styles.feesAmount}>£0.00</Text>
            </View>
            <View style={styles.feesRow}>
              <Text style={styles.feesDescription}>
                {billableDevices} additional device{billableDevices !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.feesAmount}>
                {formatCurrency(currentPrice)}
              </Text>
            </View>
            <View style={styles.feesDivider} />
            <View style={styles.feesRow}>
              <Text style={styles.feesTotalLabel}>
                Total {billingPeriod === 'monthly' ? 'Monthly' : 'Annual'} Fee
              </Text>
              <Text style={styles.feesTotal}>
                {formatCurrency(currentPrice)}
              </Text>
            </View>

            {billingPeriod === 'monthly' && (
              <View style={styles.savingsNote}>
                <Text style={styles.savingsNoteText}>
                  Switch to annual billing and save up to 38% on your subscription!
                </Text>
              </View>
            )}
          </View>
        </View>

        <CustomerSheetManager
          customerId={billingData?.customer?.id}
          onPaymentMethodSelected={(paymentMethod) => {
            console.log('Payment method selected:', paymentMethod);
            // Optionally refresh billing data
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
                  // Use Stripe's native hosted invoice URL
                  const invoiceUrl = invoice.hosted_invoice_url || invoice.invoice_pdf;

                  if (invoiceUrl) {
                    try {
                      // Open invoice in native in-app browser
                      await WebBrowser.openBrowserAsync(invoiceUrl, {
                        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                        controlsColor: ORANGE_COLOR,
                      });
                    } catch (error) {
                      console.log('Error opening invoice:', error);
                      Alert.alert(
                        'Error',
                        'Unable to open invoice. Please try again.',
                        [{ text: 'OK' }]
                      );
                    }
                  } else {
                    Alert.alert(
                      'Invoice Unavailable',
                      'This invoice is not yet available. Please try again later.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
              >
                <View style={styles.invoiceCardHeader}>
                  <Text style={styles.invoiceCardDate}>{formatDate(invoice.created)}</Text>
                  <View style={[
                    styles.invoiceStatusBadge,
                    { backgroundColor: invoice.status === 'paid' ? '#4CAF50' : '#F44336' }
                  ]}>
                    <Text style={styles.invoiceStatusBadgeText}>{invoice.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.invoiceCardBody}>
                  <Text style={styles.invoiceCardAmount}>
                    {formatCurrency(invoice.amount_paid, invoice.currency)}
                  </Text>
                  <Text style={styles.invoiceCardPeriod}>
                    {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.actionsContainer}>
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, processingAction && styles.disabledButton]}
              onPress={handleChangePlan}
              disabled={processingAction}
            >
              <Ionicons name="repeat" size={20} color={ORANGE_COLOR} />
              <Text style={styles.secondaryButtonText}>Change Plan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, processingAction && styles.disabledButton]}
              onPress={handleUpdateDeviceCount}
              disabled={processingAction}
            >
              <Ionicons name="phone-portrait-outline" size={20} color={ORANGE_COLOR} />
              <Text style={styles.secondaryButtonText}>Update Devices</Text>
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
                style={[styles.cancelButton, (processingAction || subscriptionStatus === 'cancelled') && styles.disabledButton]}
                onPress={handleCancelSubscription}
                disabled={processingAction || subscriptionStatus === 'cancelled'}
              >
                <Ionicons name="close-circle-outline" size={20} color={subscriptionStatus === 'cancelled' ? '#999' : '#EF4444'} />
                <Text style={[
                  styles.cancelButtonText,
                  { color: subscriptionStatus === 'cancelled' ? '#999' : '#EF4444' }
                ]}>
                  {subscriptionStatus === 'cancelled' ? 'Cancelled' : 'Cancel Plan'}
                </Text>
              </TouchableOpacity>
            )}
          </View>


          <Text style={styles.portalDescription}>
            Updates to your device count will be reflected in your next billing cycle.
            The free tier of {billingData?.free_quota || 3} devices will always be included at no cost.
          </Text>
        </View>
      </ScrollView>

      <CustomModal
        visible={showDeviceCountModal}
        onClose={() => setShowDeviceCountModal(false)}
        title="Update Device Count"
      >
        <Text style={styles.deviceCountDescription}>
          Enter the total number of devices you want to manage.
        </Text>
        <Text style={styles.deviceCountInfo}>
          Current: {billingData?.current_device_count || 0} devices{'\n'}
          Free tier: {billingData?.free_quota || 3} devices{'\n'}
          You will be charged for devices exceeding the free tier.
        </Text>
        <TextInput
          style={styles.deviceCountInput}
          value={deviceCountInput}
          onChangeText={setDeviceCountInput}
          keyboardType="number-pad"
          placeholder="Enter device count"
          autoFocus
        />
        <View style={styles.deviceCountButtons}>
          <TouchableOpacity
            style={styles.deviceCountCancelButton}
            onPress={() => setShowDeviceCountModal(false)}
          >
            <Text style={styles.deviceCountCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deviceCountSubmitButton}
            onPress={submitDeviceCountUpdate}
          >
            <Text style={styles.deviceCountSubmitText}>Update</Text>
          </TouchableOpacity>
        </View>
      </CustomModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  billingCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  billingCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billingCardLabel: {
    fontSize: 16,
    color: '#555',
  },
  billingCardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
feesContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  feesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  feesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feesDescription: {
    fontSize: 14,
    color: '#555',
    flex: 3,
  },
  feesAmount: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  feesDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  feesTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  feesTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  savingsNote: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
  },
  savingsNoteText: {
    fontSize: 14,
    color: '#F57C00',
  },
  invoicesSection: {
    margin: 20,
    marginTop: 0,
  },
  invoicesSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    marginBottom: 12,
  },
  invoiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  invoiceCardDate: {
    fontSize: 14,
    color: '#666',
  },
  invoiceStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  invoiceStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceCardBody: {
    padding: 12,
  },
  invoiceCardAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  invoiceCardPeriod: {
    fontSize: 13,
    color: '#777',
  },
  actionsContainer: {
    margin: 20,
    marginTop: 10,
  },
  portalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE_COLOR,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  portalButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    width: '48%',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: ORANGE_COLOR,
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
    backgroundColor: '#F1F8F4',
  },
  reactivateButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
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
    backgroundColor: '#FFF5F5',
  },
  cancelButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
  portalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  noBillingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noBillingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  noBillingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  activateButton: {
    backgroundColor: ORANGE_COLOR,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  activateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  deviceCountDescription: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  deviceCountInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  deviceCountInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  deviceCountButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deviceCountCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
    alignItems: 'center',
  },
  deviceCountCancelText: {
    fontSize: 16,
    color: '#666',
  },
  deviceCountSubmitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: ORANGE_COLOR,
    marginLeft: 8,
    alignItems: 'center',
  },
  deviceCountSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ManageBillingScreen;