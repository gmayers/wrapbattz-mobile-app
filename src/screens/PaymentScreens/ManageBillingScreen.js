// ManageBillingScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Orange color to match existing UI
const ORANGE_COLOR = '#FF9500';

// Mock data for demonstration
const MOCK_BILLING_DATA = {
  total_devices: 5,
  free_devices_remaining: 0,
  billable_devices: 2,
  billing: {
    id: 'bill_123456',
    stripe_customer_id: 'cus_123456',
    stripe_subscription_id: 'sub_123456',
    status: 'active',
    plan_type: 'monthly',
    max_devices: 5,
    free_tier_used: true,
    next_billing_date: '2025-12-31T23:59:59Z'
  }
};

// Mock invoices
const MOCK_INVOICES = [
  {
    id: 'inv_001',
    stripe_invoice_id: 'in_123456',
    amount: 7.98,
    currency: 'USD',
    status: 'paid',
    invoice_date: '2025-05-01T12:00:00Z',
    paid_date: '2025-05-01T12:00:00Z'
  },
  {
    id: 'inv_002',
    stripe_invoice_id: 'in_234567',
    amount: 7.98,
    currency: 'USD',
    status: 'paid',
    invoice_date: '2025-04-01T12:00:00Z',
    paid_date: '2025-04-01T12:00:00Z'
  },
  {
    id: 'inv_003',
    stripe_invoice_id: 'in_345678',
    amount: 7.98,
    currency: 'USD',
    status: 'paid',
    invoice_date: '2025-03-01T12:00:00Z',
    paid_date: '2025-03-01T12:00:00Z'
  }
];

const ManageBillingScreen = ({ navigation }) => {
  // Mock billing data - replace with real data from API
  const billingData = MOCK_BILLING_DATA;
  const invoices = MOCK_INVOICES;
  
  const openBillingPortal = () => {
    // Placeholder for billing portal navigation
    Alert.alert('Billing Portal', 'This would open the Stripe Customer Portal for payment management.');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Check if user has an active billing plan
  const isActive = billingData?.billing?.status === 'active';
  
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
            {`${billingData.billing.plan_type} Plan - ${billingData.billable_devices} billable device${billingData.billable_devices !== 1 ? 's' : ''}`}
          </Text>
        </View>

        <View style={styles.billingCard}>
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Status:</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: 
                billingData.billing.status === 'active' ? '#4CAF50' :
                billingData.billing.status === 'past_due' ? '#FF9800' :
                billingData.billing.status === 'canceled' ? '#F44336' :
                '#757575'
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
              {billingData.billing.plan_type.charAt(0).toUpperCase() + 
               billingData.billing.plan_type.slice(1)}
            </Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Free Devices:</Text>
            <Text style={styles.billingCardValue}>3</Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Total Devices:</Text>
            <Text style={styles.billingCardValue}>{billingData.total_devices}</Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Billable Devices:</Text>
            <Text style={styles.billingCardValue}>{billingData.billable_devices}</Text>
          </View>
          
          <View style={styles.billingCardRow}>
            <Text style={styles.billingCardLabel}>Next Billing:</Text>
            <Text style={styles.billingCardValue}>
              {formatDate(billingData.billing.next_billing_date)}
            </Text>
          </View>
          
          <View style={styles.feesContainer}>
            <Text style={styles.feesTitle}>Device Management Fees</Text>
            <View style={styles.feesRow}>
              <Text style={styles.feesDescription}>Free Tier (3 devices)</Text>
              <Text style={styles.feesAmount}>$0.00</Text>
            </View>
            <View style={styles.feesRow}>
              <Text style={styles.feesDescription}>
                {billingData.billable_devices} additional device{billingData.billable_devices !== 1 ? 's' : ''} × ${billingData.billing.plan_type === 'monthly' ? '3.99' : '3.19'}
              </Text>
              <Text style={styles.feesAmount}>
                ${(billingData.billable_devices * (billingData.billing.plan_type === 'monthly' ? 3.99 : 3.19)).toFixed(2)}
              </Text>
            </View>
            <View style={styles.feesDivider} />
            <View style={styles.feesRow}>
              <Text style={styles.feesTotalLabel}>Total Monthly Fee</Text>
              <Text style={styles.feesTotal}>
                ${(billingData.billable_devices * (billingData.billing.plan_type === 'monthly' ? 3.99 : 3.19)).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {invoices.length > 0 && (
          <View style={styles.invoicesSection}>
            <Text style={styles.invoicesSectionTitle}>Recent Invoices</Text>
            {invoices.map((invoice) => (
              <View key={invoice.id} style={styles.invoiceCard}>
                <View style={styles.invoiceCardHeader}>
                  <Text style={styles.invoiceCardDate}>{formatDate(invoice.invoice_date)}</Text>
                  <View style={[
                    styles.invoiceStatusBadge,
                    { backgroundColor: invoice.status === 'paid' ? '#4CAF50' : '#F44336' }
                  ]}>
                    <Text style={styles.invoiceStatusBadgeText}>{invoice.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.invoiceCardBody}>
                  <Text style={styles.invoiceCardAmount}>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: invoice.currency,
                    }).format(invoice.amount)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.portalButton}
            onPress={openBillingPortal}
          >
            <Ionicons name="card-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.portalButtonText}>Payment Methods</Text>
          </TouchableOpacity>
          
          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => Alert.alert('Switch Plan', 'Would you like to change your billing frequency?')}
            >
              <Ionicons name="repeat" size={20} color={ORANGE_COLOR} />
              <Text style={styles.secondaryButtonText}>Change Plan</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => Alert.alert('Cancel Plan', 'Are you sure you want to cancel your device management plan?')}
            >
              <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
              <Text style={[styles.secondaryButtonText, { color: '#EF4444' }]}>Cancel Plan</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.portalDescription}>
            Updates to your device count will be reflected in your next billing cycle.
            The free tier of 3 devices will always be included at no cost.
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
  },
  feesAmount: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
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