import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { createBillingService } from '../../services/BillingService';

const ORANGE_COLOR = '#FF9500';

const PaymentHistoryScreen = ({ navigation }) => {
  const { axiosInstance, isAdminOrOwner } = useAuth();
  const billingService = createBillingService(axiosInstance);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [successfulPayments, setSuccessfulPayments] = useState(0);
  const [failedPayments, setFailedPayments] = useState(0);

  // Check permissions
  React.useEffect(() => {
    if (!isAdminOrOwner) {
      Alert.alert(
        'Access Denied',
        'Only organization admins and owners can view payment history.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isAdminOrOwner, navigation]);

  const fetchPaymentHistory = async () => {
    try {
      const response = await billingService.getPaymentHistory();
      const payments = Array.isArray(response) ? response : response?.results || [];
      setPaymentHistory(payments);

      // Calculate statistics
      const total = payments.reduce((sum, payment) => {
        return payment.status === 'succeeded' ? sum + payment.amount : sum;
      }, 0);

      const successful = payments.filter(p => p.status === 'succeeded').length;
      const failed = payments.filter(p => p.status === 'failed').length;

      setTotalPaid(total);
      setSuccessfulPayments(successful);
      setFailedPayments(failed);
    } catch (error) {
      // Check if it's a 404 (no payment history yet)
      if (error.response?.status === 404) {
        console.log('ℹ️ No payment history found - billing may not be set up yet');
        setPaymentHistory([]);
        setTotalPaid(0);
        setSuccessfulPayments(0);
        setFailedPayments(0);
      } else {
        console.error('Error fetching payment history:', error);
        Alert.alert('Error', 'Unable to load payment history. Please try again later.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPaymentHistory();
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'succeeded':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      case 'pending':
        return '#FF9800';
      case 'canceled':
        return '#999';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'succeeded':
        return 'checkmark-circle';
      case 'failed':
        return 'close-circle';
      case 'pending':
        return 'time';
      case 'canceled':
        return 'ban';
      default:
        return 'help-circle';
    }
  };

  const handlePaymentPress = async (payment) => {
    if (payment.receipt_url) {
      try {
        await Linking.openURL(payment.receipt_url);
      } catch (error) {
        console.error('Error opening receipt:', error);
        Alert.alert('Error', 'Unable to open receipt. Please try again later.');
      }
    } else if (payment.status === 'failed' && payment.failure_reason) {
      Alert.alert(
        'Payment Failed',
        payment.failure_reason,
        [{ text: 'OK' }]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading payment history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment History</Text>
          <Text style={styles.headerSubtitle}>
            Complete record of all billing transactions
          </Text>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(totalPaid)}</Text>
            <Text style={styles.statLabel}>Total Paid</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
              {successfulPayments}
            </Text>
            <Text style={styles.statLabel}>Successful</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F44336' }]}>
              {failedPayments}
            </Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
        </View>

        {/* Payment History List */}
        {paymentHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>No payment history found</Text>
            <Text style={styles.emptySubtext}>
              Payments will appear here once billing begins
            </Text>
          </View>
        ) : (
          <View style={styles.paymentsContainer}>
            <Text style={styles.sectionTitle}>Payment Transactions</Text>
            {paymentHistory.map((payment) => (
              <TouchableOpacity
                key={payment.id}
                style={styles.paymentCard}
                onPress={() => handlePaymentPress(payment)}
              >
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentInfo}>
                    <Ionicons
                      name={getStatusIcon(payment.status)}
                      size={24}
                      color={getStatusColor(payment.status)}
                      style={styles.statusIcon}
                    />
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentAmount}>
                        {formatCurrency(payment.amount, payment.currency)}
                      </Text>
                      <Text style={styles.paymentDate}>
                        {formatDate(payment.created)}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(payment.status) },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {payment.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {payment.description && (
                  <Text style={styles.paymentDescription}>
                    {payment.description}
                  </Text>
                )}

                {payment.payment_method && (
                  <View style={styles.paymentMethodInfo}>
                    <Ionicons name="card" size={16} color="#666" />
                    <Text style={styles.paymentMethodText}>
                      {payment.payment_method.card
                        ? `${payment.payment_method.card.brand.toUpperCase()} •••• ${payment.payment_method.card.last4}`
                        : payment.payment_method.type}
                    </Text>
                  </View>
                )}

                {payment.failure_reason && (
                  <View style={styles.failureReasonContainer}>
                    <Ionicons name="warning" size={16} color="#F44336" />
                    <Text style={styles.failureReasonText}>
                      {payment.failure_reason}
                    </Text>
                  </View>
                )}

                {payment.receipt_url && (
                  <View style={styles.receiptContainer}>
                    <Ionicons name="receipt" size={16} color={ORANGE_COLOR} />
                    <Text style={styles.receiptText}>Tap to view receipt</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#FFFFFF',
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
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  paymentsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    marginRight: 12,
  },
  paymentDetails: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  paymentDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paymentDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  failureReasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  failureReasonText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 6,
    flex: 1,
  },
  receiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  receiptText: {
    fontSize: 14,
    color: ORANGE_COLOR,
    marginLeft: 6,
    fontWeight: '500',
  },
});

export default PaymentHistoryScreen;