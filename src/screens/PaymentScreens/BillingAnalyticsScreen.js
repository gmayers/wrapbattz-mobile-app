import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { billingErrorMessage, isBillingUnavailable } from '../../api/billingErrors';
import { getBillingState, getInvoices, getPlans } from '../../api/endpoints/billing';

const ORANGE_COLOR = '#FFC72C';
const { width } = Dimensions.get('window');

// Device counts to price up in the projections table.
const PROJECTION_STEPS = [10, 25, 50, 100];

/**
 * Derive analytics from the data the API actually exposes.
 *
 * There is no analytics endpoint and no historical usage series, so spend
 * history comes from invoices and everything else from current billing state.
 * The previous version of this screen fell back to hard-coded sample figures
 * when its (nonexistent) endpoint failed, which showed invented numbers as if
 * they were real — hence no mock data anywhere in here.
 */
function buildAnalytics(state, invoices, plansResponse) {
  const paid = invoices.filter((i) => i.status === 'paid');

  // Invoices → one bar per calendar month, oldest first.
  const byMonth = new Map();
  for (const invoice of paid) {
    const date = new Date(invoice.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + invoice.amount);
  }
  const monthly_costs = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  const total_paid = paid.reduce((sum, i) => sum + i.amount, 0);
  const average_monthly_cost = monthly_costs.length
    ? Math.round(total_paid / monthly_costs.length)
    : 0;

  const plan = plansResponse?.plans?.find((p) => p.slug === state?.tier) ?? null;
  const deviceAddon = plansResponse?.addons?.devices ?? null;
  const currency = plan?.currency ?? 'GBP';

  // Projections need a plan price and a per-device add-on rate; without both
  // the table would be guesswork, so it's omitted instead.
  let cost_projections = [];
  if (plan && deviceAddon) {
    const included = plan.included_devices ?? 0;
    const monthlyBase = plan.monthly_price ?? 0;
    cost_projections = PROJECTION_STEPS.map((device_count) => {
      const extra = Math.max(0, device_count - included);
      const monthly_cost = monthlyBase + extra * deviceAddon.unit_price_monthly;
      const annual_cost = plan.annual_price != null
        ? plan.annual_price + extra * deviceAddon.unit_price_monthly * 12
        : monthly_cost * 12;
      return {
        device_count,
        monthly_cost,
        annual_cost,
        savings_annual: Math.max(0, monthly_cost * 12 - annual_cost),
      };
    });
  }

  return {
    currency,
    monthly_costs,
    billing_summary: {
      total_paid,
      average_monthly_cost,
      devices_used: state?.limits?.devices?.used ?? 0,
      devices_limit: state?.limits?.devices?.limit ?? 0,
      seats_used: state?.limits?.seats?.used ?? 0,
      seats_limit: state?.limits?.seats?.limit ?? 0,
      credits: state?.credits?.balance ?? 0,
    },
    cost_projections,
  };
}

const BillingAnalyticsScreen = ({ navigation }) => {
  const { isAdminOrOwner } = useAuth();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (!isAdminOrOwner) {
      Alert.alert(
        'Access Denied',
        'Only organization admins and owners can view billing analytics.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isAdminOrOwner, navigation]);

  const fetchAnalytics = useCallback(async () => {
    const [stateResult, invoicesResult, plansResult] = await Promise.allSettled([
      getBillingState(),
      getInvoices(),
      getPlans(),
    ]);

    if (stateResult.status === 'rejected' && invoicesResult.status === 'rejected') {
      setAnalytics(null);
      if (!isBillingUnavailable(stateResult.reason)) {
        Alert.alert('Error', billingErrorMessage(stateResult.reason, 'Unable to load analytics.'));
      }
    } else {
      setAnalytics(
        buildAnalytics(
          stateResult.status === 'fulfilled' ? stateResult.value : null,
          invoicesResult.status === 'fulfilled' ? invoicesResult.value : [],
          plansResult.status === 'fulfilled' ? plansResult.value : null
        )
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  // Every money value on this API is integer minor units.
  const formatCurrency = (minorUnits, currency = analytics?.currency ?? 'GBP') => {
    const amount = typeof minorUnits === 'number' ? minorUnits / 100 : 0;
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  };

  const formatMonth = (value) => {
    const date = new Date(`${value}-01T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
  };

  const renderCostTrends = () => {
    if (!analytics?.monthly_costs?.length) return null;

    const maxCost = Math.max(...analytics.monthly_costs.map((c) => c.amount));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Monthly Spend</Text>
        <View style={styles.chart}>
          {analytics.monthly_costs.map((cost) => {
            const height = maxCost > 0 ? (cost.amount / maxCost) * 100 : 0;
            return (
              <View key={cost.month} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View
                    style={[styles.bar, { height: `${Math.max(height, 5)}%`, backgroundColor: '#4CAF50' }]}
                  />
                </View>
                <Text style={styles.barLabel}>{formatMonth(cost.month)}</Text>
                <Text style={styles.barValue}>{formatCurrency(cost.amount)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Current allowances, in place of the historical usage series the API
  // does not provide.
  const renderCurrentUsage = () => {
    const summary = analytics?.billing_summary;
    if (!summary) return null;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Current Usage</Text>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {`${summary.devices_used}/${summary.devices_limit}`}
            </Text>
            <Text style={styles.summaryLabel}>Devices</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {`${summary.seats_used}/${summary.seats_limit}`}
            </Text>
            <Text style={styles.summaryLabel}>Seats</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.credits}</Text>
            <Text style={styles.summaryLabel}>Credits</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading billing analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analytics) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Billing Analytics</Text>
            <Text style={styles.headerSubtitle}>Usage and cost analysis</Text>
          </View>

          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>No analytics data available</Text>
            <Text style={styles.emptySubtext}>
              Analytics will appear once you have an active subscription and billing history
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Billing Analytics</Text>
          <Text style={styles.headerSubtitle}>Usage and cost analysis</Text>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatCurrency(analytics.billing_summary.total_paid)}
            </Text>
            <Text style={styles.summaryLabel}>Total Paid</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatCurrency(analytics.billing_summary.average_monthly_cost)}
            </Text>
            <Text style={styles.summaryLabel}>Avg Monthly</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{analytics.billing_summary.devices_used}</Text>
            <Text style={styles.summaryLabel}>Devices</Text>
          </View>
        </View>

        {renderCurrentUsage()}
        {renderCostTrends()}

        {analytics.cost_projections.length > 0 && (
          <View style={styles.projectionsContainer}>
            <Text style={styles.sectionTitle}>Cost Projections</Text>
            <Text style={styles.sectionSubtitle}>
              Estimated costs for different device counts on your current plan
            </Text>
            {analytics.cost_projections.map((projection) => (
              <View key={projection.device_count} style={styles.projectionCard}>
                <View style={styles.projectionHeader}>
                  <Text style={styles.projectionDevices}>
                    {projection.device_count} devices
                  </Text>
                  <View style={styles.projectionCosts}>
                    <Text style={styles.projectionMonthly}>
                      {formatCurrency(projection.monthly_cost)}/mo
                    </Text>
                    <Text style={styles.projectionAnnual}>
                      {formatCurrency(projection.annual_cost)}/yr
                    </Text>
                  </View>
                </View>
                {projection.savings_annual > 0 && (
                  <View style={styles.savingsContainer}>
                    <Ionicons name="trending-down" size={16} color="#4CAF50" />
                    <Text style={styles.savingsText}>
                      Save {formatCurrency(projection.savings_annual)} annually
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.insightsContainer}>
          <Text style={styles.sectionTitle}>Insights</Text>

          <TouchableOpacity
            style={styles.insightCard}
            onPress={() => navigation.navigate('PaymentHistory')}
          >
            <Ionicons name="receipt" size={24} color="#2196F3" />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Invoices</Text>
              <Text style={styles.insightText}>
                View every invoice issued to your organisation
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>
        </View>
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
  summaryContainer: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between'
},
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE'
},
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
},
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
},
  chartContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE'
},
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16
},
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'end',
    height: 150,
    marginBottom: 16
},
  chartBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2
},
  barContainer: {
    width: '80%',
    height: 120,
    justifyContent: 'flex-end',
    position: 'relative'
},
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4
},
  barLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center'
},
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center'
},
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8
},
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12
},
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6
},
  legendText: {
    fontSize: 12,
    color: '#666'
},
  projectionsContainer: {
    margin: 20
},
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
},
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
},
  projectionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE'
},
  projectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
},
  projectionDevices: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
},
  projectionCosts: {
    alignItems: 'flex-end'
},
  projectionMonthly: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
},
  projectionAnnual: {
    fontSize: 14,
    color: '#666'
},
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    padding: 8,
    borderRadius: 6
},
  savingsText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '500'
},
  insightsContainer: {
    margin: 20
},
  insightCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE'
},
  insightContent: {
    flex: 1,
    marginLeft: 12
},
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
},
  insightText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
},
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400
},
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8
},
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20
}
});


export default BillingAnalyticsScreen;
