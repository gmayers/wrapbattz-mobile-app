import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { billingErrorMessage, isBillingUnavailable } from '../../api/billingErrors';
import { getInvoices } from '../../api/endpoints/billing';

const LINK_COLOR = '#2196F3';

const PaymentHistoryScreen = ({ navigation }) => {
  const { isAdminOrOwner } = useAuth();
  const { colors } = useTheme();

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

  // There is no payment-history endpoint; invoices are the billing record the
  // API actually exposes, so the history is derived from them.
  const fetchPaymentHistory = async () => {
    try {
      const invoices = await getInvoices();
      setPaymentHistory(invoices);

      // Only settled invoices count towards "paid"; open/draft ones haven't
      // been collected yet.
      const total = invoices.reduce(
        (sum, invoice) => (invoice.status === 'paid' ? sum + invoice.amount : sum),
        0
      );

      setTotalPaid(total);
      setSuccessfulPayments(invoices.filter((i) => i.status === 'paid').length);
      setFailedPayments(
        invoices.filter((i) => i.status === 'uncollectible' || i.status === 'void').length
      );
    } catch (error) {
      setPaymentHistory([]);
      setTotalPaid(0);
      setSuccessfulPayments(0);
      setFailedPayments(0);
      // Billing not set up / not reachable is an empty state, not an error.
      if (!isBillingUnavailable(error)) {
        Alert.alert('Error', billingErrorMessage(error, 'Unable to load payment history.'));
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

  // Invoice amounts arrive as integer minor units.
  const formatCurrency = (minorUnits, currency = 'GBP') => {
    const amount = typeof minorUnits === 'number' ? minorUnits / 100 : 0;
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
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
      day: 'numeric'
});
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return '#4CAF50';
      case 'uncollectible':
      case 'void':
        return '#F44336';
      case 'open':
      case 'draft':
        return '#FF9800';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return 'checkmark-circle';
      case 'uncollectible':
      case 'void':
        return 'close-circle';
      case 'open':
      case 'draft':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  const handlePaymentPress = async (invoice) => {
    const url = invoice.hosted_invoice_url || invoice.pdf_url;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Unable to open invoice. Please try again later.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading payment history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Payment History</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Every invoice issued to your organisation
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
            <Text style={styles.emptyText}>No invoices yet</Text>
            <Text style={styles.emptySubtext}>
              Invoices will appear here once billing begins
            </Text>
          </View>
        ) : (
          <View style={styles.paymentsContainer}>
            <Text style={styles.sectionTitle}>Invoices</Text>
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
                        {formatCurrency(payment.amount)}
                      </Text>
                      <Text style={styles.paymentDate}>
                        {formatDate(payment.created_at)}
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
                      {(payment.status || 'unknown').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {payment.number && (
                  <Text style={styles.paymentDescription}>Invoice {payment.number}</Text>
                )}

                {(payment.hosted_invoice_url || payment.pdf_url) && (
                  <View style={styles.receiptContainer}>
                    <Ionicons name="receipt" size={16} color={colors.primary} />
                    <Text style={styles.receiptText}>Tap to view invoice</Text>
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
    backgroundColor: '#F5F5F5'
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
    backgroundColor: '#FFFFFF',
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
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between'
},
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE'
},
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
},
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
},
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
},
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8
},
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center'
},
  paymentsContainer: {
    padding: 20
},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16
},
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE'
},
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
},
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
},
  statusIcon: {
    marginRight: 12
},
  paymentDetails: {
    flex: 1
},
  paymentAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
},
  paymentDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2
},
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
},
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF'
},
  paymentDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
},
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
},
  paymentMethodText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6
},
  failureReasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8
},
  failureReasonText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 6,
    flex: 1
},
  receiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
},
  receiptText: {
    fontSize: 14,
    color: LINK_COLOR,
    marginLeft: 6,
    fontWeight: '500'
}
});

export default PaymentHistoryScreen;