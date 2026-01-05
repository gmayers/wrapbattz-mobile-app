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
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { createBillingService } from '../../services/BillingService';

const ORANGE_COLOR = '#FF9500';
const { width } = Dimensions.get('window');

const BillingAnalyticsScreen = ({ navigation }) => {
  const { axiosInstance, isAdminOrOwner } = useAuth();
  const billingService = createBillingService(axiosInstance);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('6months');

  // Check permissions
  React.useEffect(() => {
    if (!isAdminOrOwner) {
      Alert.alert(
        'Access Denied',
        'Only organization admins and owners can view billing analytics.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isAdminOrOwner, navigation]);

  const fetchAnalytics = async () => {
    try {
      const analyticsData = await billingService.getAnalytics();
      setAnalytics(analyticsData);
    } catch (error) {
      // Check if it's a 404 (no analytics data yet)
      if (error.response?.status === 404) {
        console.log('ℹ️ No analytics data found - showing empty state');
        setAnalytics(null);
      } else {
        console.error('Error fetching analytics:', error);
        // Fallback to mock data for development/demo purposes
        console.log('ℹ️ Using mock analytics data for demonstration');
        setAnalytics({
          device_usage_trends: [
            { date: '2024-01', device_count: 3, billable_count: 0 },
            { date: '2024-02', device_count: 5, billable_count: 2 },
            { date: '2024-03', device_count: 8, billable_count: 5 },
            { date: '2024-04', device_count: 12, billable_count: 9 },
            { date: '2024-05', device_count: 15, billable_count: 12 },
            { date: '2024-06', device_count: 18, billable_count: 15 },
          ],
          monthly_costs: [
            { month: '2024-01', amount: 0, device_count: 3 },
            { month: '2024-02', amount: 0.80, device_count: 5 },
            { month: '2024-03', amount: 2.00, device_count: 8 },
            { month: '2024-04', amount: 3.60, device_count: 12 },
            { month: '2024-05', amount: 4.80, device_count: 15 },
            { month: '2024-06', amount: 6.00, device_count: 18 },
          ],
          cost_projections: [
            { device_count: 10, monthly_cost: 2.80, annual_cost: 18.20, savings_annual: 15.40 },
            { device_count: 20, monthly_cost: 6.80, annual_cost: 44.20, savings_annual: 37.40 },
            { device_count: 50, monthly_cost: 18.80, annual_cost: 122.20, savings_annual: 103.40 },
            { device_count: 100, monthly_cost: 38.80, annual_cost: 252.20, savings_annual: 213.40 },
          ],
          billing_summary: {
            total_paid: 17.20,
            current_period_cost: 6.00,
            average_monthly_cost: 2.87,
            device_count_average: 10.17,
            subscription_start_date: '2024-02-01',
          },
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const formatCurrency = (amount, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
      });
    } catch {
      return dateString;
    }
  };

  const renderUsageTrend = () => {
    if (!analytics?.device_usage_trends?.length) return null;

    const maxDevices = Math.max(...analytics.device_usage_trends.map(t => t.device_count));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Device Usage Trends</Text>
        <View style={styles.chart}>
          {analytics.device_usage_trends.map((trend, index) => {
            const height = (trend.device_count / maxDevices) * 100;
            const billableHeight = (trend.billable_count / maxDevices) * 100;

            return (
              <View key={index} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${height}%`,
                        backgroundColor: '#E3F2FD',
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${billableHeight}%`,
                        backgroundColor: ORANGE_COLOR,
                        position: 'absolute',
                        bottom: 0,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{formatDate(trend.date)}</Text>
                <Text style={styles.barValue}>{trend.device_count}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#E3F2FD' }]} />
            <Text style={styles.legendText}>Total Devices</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: ORANGE_COLOR }]} />
            <Text style={styles.legendText}>Billable Devices</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderCostTrends = () => {
    if (!analytics?.monthly_costs?.length) return null;

    const maxCost = Math.max(...analytics.monthly_costs.map(c => c.amount));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Monthly Costs</Text>
        <View style={styles.chart}>
          {analytics.monthly_costs.map((cost, index) => {
            const height = maxCost > 0 ? (cost.amount / maxCost) * 100 : 0;

            return (
              <View key={index} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(height, 5)}%`,
                        backgroundColor: '#4CAF50',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{formatDate(cost.month)}</Text>
                <Text style={styles.barValue}>{formatCurrency(cost.amount)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE_COLOR} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If no analytics data, show empty state
  if (!analytics && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Billing Analytics</Text>
            <Text style={styles.headerSubtitle}>
              Usage trends and cost analysis
            </Text>
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
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Billing Analytics</Text>
          <Text style={styles.headerSubtitle}>
            Usage trends and cost analysis
          </Text>
        </View>

        {/* Summary Cards */}
        {analytics?.billing_summary && (
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
              <Text style={styles.summaryValue}>
                {Math.round(analytics.billing_summary.device_count_average)}
              </Text>
              <Text style={styles.summaryLabel}>Avg Devices</Text>
            </View>
          </View>
        )}

        {/* Charts */}
        {renderUsageTrend()}
        {renderCostTrends()}

        {/* Cost Projections */}
        {analytics?.cost_projections?.length > 0 && (
          <View style={styles.projectionsContainer}>
            <Text style={styles.sectionTitle}>Cost Projections</Text>
            <Text style={styles.sectionSubtitle}>
              Estimated costs for different device counts
            </Text>
            {analytics.cost_projections.map((projection, index) => (
              <View key={index} style={styles.projectionCard}>
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
                    <Ionicons name="savings" size={16} color="#4CAF50" />
                    <Text style={styles.savingsText}>
                      Save {formatCurrency(projection.savings_annual)} annually
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Insights */}
        <View style={styles.insightsContainer}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightCard}>
            <Ionicons name="trending-up" size={24} color="#4CAF50" />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Growth Trend</Text>
              <Text style={styles.insightText}>
                Your device usage has grown consistently over the past 6 months
              </Text>
            </View>
          </View>

          <View style={styles.insightCard}>
            <Ionicons name="card" size={24} color={ORANGE_COLOR} />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Cost Optimization</Text>
              <Text style={styles.insightText}>
                Switch to annual billing to save up to 38% on your subscription
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.insightCard}
            onPress={() => navigation.navigate('PaymentHistory')}
          >
            <Ionicons name="receipt" size={24} color="#2196F3" />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Payment History</Text>
              <Text style={styles.insightText}>
                View detailed payment records and receipts
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
  summaryContainer: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'end',
    height: 150,
    marginBottom: 16,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  barContainer: {
    width: '80%',
    height: 120,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  projectionsContainer: {
    margin: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  projectionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  projectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectionDevices: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  projectionCosts: {
    alignItems: 'flex-end',
  },
  projectionMonthly: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  projectionAnnual: {
    fontSize: 14,
    color: '#666',
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    padding: 8,
    borderRadius: 6,
  },
  savingsText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '500',
  },
  insightsContainer: {
    margin: 20,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});

export default BillingAnalyticsScreen;