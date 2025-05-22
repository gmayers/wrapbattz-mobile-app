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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Orange color to match existing UI
const ORANGE_COLOR = '#FF9500';

const ManageBillingScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  
  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setBillingData({
        devices: {
          total: 5,
          active: 5,
          inactive: 0,
          free_quota: 3,
          billable: 2
        },
        tier: {
          name: "1-100 Stickers",
          price_per_device: {
            monthly: 0.40,
            annual: 0.25
          }
        },
        billing: {
          status: 'active',
          cycle: 'monthly',
          free_quota: 3,
          next_billing_date: new Date().setMonth(new Date().getMonth() + 1),
          price_per_device: 0.40,
          total_monthly_cost: 0.80
        },
      });
      
      setInvoices([
        {
          id: 'inv_001',
          amount_paid: 0.80,
          currency: 'gbp',
          status: 'paid',
          created: Math.floor(new Date().setDate(new Date().getDate() - 5) / 1000),
          period_start: Math.floor(new Date().setDate(new Date().getDate() - 35) / 1000),
          period_end: Math.floor(new Date().setDate(new Date().getDate() - 5) / 1000)
        },
        {
          id: 'inv_002',
          amount_paid: 0.80,
          currency: 'gbp',
          status: 'paid',
          created: Math.floor(new Date().setDate(new Date().getDate() - 35) / 1000),
          period_start: Math.floor(new Date().setDate(new Date().getDate() - 65) / 1000),
          period_end: Math.floor(new Date().setDate(new Date().getDate() - 35) / 1000)
        }
      ]);
      
      setLoading(false);
    }, 1000);
  }, []);
  
  const openBillingPortal = () => {
    // Simulate opening a billing portal
    Alert.alert(
      'Payment Methods', 
      'This would display your payment methods and allow you to add, edit, or remove them.',
      [{ text: 'OK' }]
    );
  };
  
  const handleChangePlan = () => {
    Alert.alert(
      'Change Billing Plan',
      `Would you like to switch to ${billingData.billing.cycle === 'monthly' ? 'annual' : 'monthly'} billing?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Change Plan', 
          onPress: () => {
            Alert.alert(
              'Plan Updated', 
              `Your plan has been changed to ${billingData.billing.cycle === 'monthly' ? 'annual' : 'monthly'} billing. The change will take effect on your next billing date.`
            );
            // Update billing data to show the change
            setBillingData({
              ...billingData,
              billing: {
                ...billingData.billing,
                cycle: billingData.billing.cycle === 'monthly' ? 'annual' : 'monthly',
                price_per_device: billingData.billing.cycle === 'monthly' ? 0.25 : 0.40,
                total_monthly_cost: billingData.billing.cycle === 'monthly' 
                  ? billingData.devices.billable * 0.25 
                  : billingData.devices.billable * 0.40
              }
            });
          }
        }
      ]
    );
  };
  
  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Subscription Cancelled', 
              'Your subscription has been cancelled. It will remain active until the end of your current billing period.',
              [
                { 
                  text: 'OK', 
                  onPress: () => {
                    // Update billing status to show as cancelled but still active
                    setBillingData({
                      ...billingData,
                      billing: {
                        ...billingData.billing,
                        status: 'cancelled'
                      }
                    });
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };
  
  const formatCurrency = (amount, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000); // Convert to milliseconds if timestamp
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
  
  // Check if user has an active billing plan
  const isActive = billingData?.billing?.status === 'active' || billingData?.billing?.status === 'cancelled';
  
  if (!isActive) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noBillingContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#888" />
          <Text style={styles.noBillingText}>You don't have an active billing plan</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Billing</Text>
          <Text style={styles.headerSubtitle}>
            {`${billingData.billing.cycle} Plan - ${billingData.tier.name}`}
          </Text>
        </View>

        <View style={styles.billingCard}>
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Status:</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: 
                billingData.billing.status === 'active' ? '#4CAF50' :
                billingData.billing.status === 'cancelled' ? '#FF9800' :
                billingData.billing.status === 'past_due' ? '#FF9800' :
                '#F44336'
              }
            ]}>
              <Text style={styles.statusBadgeText}>
                {billingData.billing.status.toUpperCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Plan:</Text>
            <Text style={styles.billingCardValue}>
              {billingData.billing.cycle.charAt(0).toUpperCase() + 
               billingData.billing.cycle.slice(1)}
            </Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Pricing Tier:</Text>
            <Text style={styles.billingCardValue}>{billingData.tier.name}</Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Free Devices:</Text>
            <Text style={styles.billingCardValue}>{billingData.billing.free_quota}</Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Total Devices:</Text>
            <Text style={styles.billingCardValue}>{billingData.devices.total}</Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Billable Devices:</Text>
            <Text style={styles.billingCardValue}>{billingData.devices.billable}</Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Next Billing:</Text>
            <Text style={styles.billingCardValue}>
              {formatDate(billingData.billing.next_billing_date / 1000)}
            </Text>
          </View>
          
          <View style={styles.feesContainer}>
            <Text style={styles.feesTitle}>Device Management Fees</Text>
            <View style={styles.feesRow}>
              <Text style={styles.feesDescription}>Free Tier ({billingData.billing.free_quota} devices)</Text>
              <Text style={styles.feesAmount}>£0.00</Text>
            </View>
            <View style={styles.feesRow}>
              <Text style={styles.feesDescription}>
                {billingData.devices.billable} additional device{billingData.devices.billable !== 1 ? 's' : ''} × 
                {formatCurrency(billingData.billing.price_per_device)}
              </Text>
              <Text style={styles.feesAmount}>
                {formatCurrency(billingData.billing.total_monthly_cost)}
              </Text>
            </View>
            <View style={styles.feesDivider} />
            <View style={styles.feesRow}>
              <Text style={styles.feesTotalLabel}>
                Total {billingData.billing.cycle === 'monthly' ? 'Monthly' : 'Annual'} Fee
              </Text>
              <Text style={styles.feesTotal}>
                {formatCurrency(billingData.billing.total_monthly_cost)}
              </Text>
            </View>
            
            {billingData.billing.cycle === 'monthly' && (
              <View style={styles.savingsNote}>
                <Text style={styles.savingsNoteText}>
                  Switch to annual billing and save up to 38% on your subscription!
                </Text>
              </View>
            )}
          </View>
        </View>

        {invoices.length > 0 && (
          <View style={styles.invoicesSection}>
            <Text style={styles.invoicesSectionTitle}>Recent Invoices</Text>
            {invoices.map((invoice) => (
              <TouchableOpacity
                key={invoice.id}
                style={styles.invoiceCard}
                onPress={() => Alert.alert('Invoice Details', 'This would show detailed invoice information.')}
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
          <TouchableOpacity
            style={styles.portalButton}
            onPress={openBillingPortal}
          >
            <Ionicons name="card-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.portalButtonText}>Manage Payment Methods</Text>
          </TouchableOpacity>
          
          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={handleChangePlan}
            >
              <Ionicons name="repeat" size={20} color={ORANGE_COLOR} />
              <Text style={styles.secondaryButtonText}>Change Plan</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={handleCancelSubscription}
              disabled={billingData.billing.status === 'cancelled'}
            >
              <Ionicons name="close-circle-outline" size={20} color={billingData.billing.status === 'cancelled' ? '#999' : '#EF4444'} />
              <Text style={[
                styles.secondaryButtonText, 
                { color: billingData.billing.status === 'cancelled' ? '#999' : '#EF4444' }
              ]}>
                {billingData.billing.status === 'cancelled' ? 'Cancelled' : 'Cancel Plan'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.portalDescription}>
            Updates to your device count will be reflected in your next billing cycle.
            The free tier of {billingData.billing.free_quota} devices will always be included at no cost.
          </Text>
        </View>
      </ScrollView>
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
    marginBottom: 20,
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
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
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
});

export default ManageBillingScreen;