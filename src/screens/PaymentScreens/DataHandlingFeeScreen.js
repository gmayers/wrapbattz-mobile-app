import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import SubscriptionSetup from '../../components/SubscriptionSetup';
import { billingErrorMessage, isBillingUnavailable } from '../../api/billingErrors';
import { getBillingState, getPlans } from '../../api/endpoints/billing';

const formatCurrency = (minorUnits, currency = 'GBP') => {
  if (minorUnits == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minorUnits / 100);
};

/**
 * Plan selection and billing hub.
 *
 * This used to price a bespoke "pence per device beyond 3 free" model with
 * hard-coded tiers. The server bills per plan (with included seats/devices)
 * plus metered add-ons, so every figure here now comes from
 * GET /billing/plans/ and GET /billing/ instead of constants in the app.
 */
const DataHandlingFeeScreen = ({ navigation }) => {
  const { isAdminOrOwner } = useAuth();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [addons, setAddons] = useState({});
  const [state, setState] = useState(null);
  const [billingInterval, setBillingInterval] = useState('annual');
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (!isAdminOrOwner) {
      Alert.alert(
        'Access Denied',
        'Only organization admins and owners can manage billing.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [isAdminOrOwner, navigation]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [plansResult, stateResult] = await Promise.allSettled([getPlans(), getBillingState()]);

    if (plansResult.status === 'fulfilled') {
      setPlans(plansResult.value.plans ?? []);
      setAddons(plansResult.value.addons ?? {});
      setSelectedSlug((current) => current ?? plansResult.value.plans?.[0]?.slug ?? null);
    } else {
      setPlans([]);
      setAddons({});
      if (!isBillingUnavailable(plansResult.reason)) {
        Alert.alert('Error', billingErrorMessage(plansResult.reason, 'Unable to load plans.'));
      }
    }

    setState(stateResult.status === 'fulfilled' ? stateResult.value : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedPlan = plans.find((p) => p.slug === selectedSlug) ?? null;
  const currency = selectedPlan?.currency ?? 'GBP';
  const price = selectedPlan
    ? (billingInterval === 'annual' ? selectedPlan.annual_price : selectedPlan.monthly_price)
    : null;

  const handleSubscribe = () => {
    if (!selectedPlan) return;
    if (price == null) {
      Alert.alert(
        'Not Available',
        `This plan has no ${billingInterval} price configured. Choose a different billing period.`
      );
      return;
    }
    setShowPayment(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading plans...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Plans & Billing</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {state?.status && state.status !== 'none'
              ? `Current status: ${state.status.replace('_', ' ')}`
              : 'Choose a plan to get started'}
          </Text>
        </View>

        {plans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="pricetags-outline" size={60} color="#CCC" />
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
              Plans are unavailable
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Billing isn't set up on this server yet. Please try again later.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.toggleRow}>
              {['monthly', 'annual'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.toggleButton,
                    billingInterval === option && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setBillingInterval(option)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      { color: billingInterval === option ? '#000' : colors.textSecondary },
                    ]}
                  >
                    {option === 'monthly' ? 'Monthly' : 'Annual'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {plans.map((plan) => {
              const planPrice = billingInterval === 'annual' ? plan.annual_price : plan.monthly_price;
              const isSelected = plan.slug === selectedSlug;
              return (
                <TouchableOpacity
                  key={plan.slug}
                  style={[
                    styles.planCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isSelected && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedSlug(plan.slug)}
                >
                  <View style={styles.planHeader}>
                    <Text style={[styles.planName, { color: colors.textPrimary }]}>{plan.name}</Text>
                    <Text style={[styles.planPrice, { color: colors.textPrimary }]}>
                      {formatCurrency(planPrice, plan.currency)}
                      <Text style={styles.planPeriod}>
                        {billingInterval === 'annual' ? '/yr' : '/mo'}
                      </Text>
                    </Text>
                  </View>

                  {!!plan.subhead && (
                    <Text style={[styles.planSubhead, { color: colors.textSecondary }]}>
                      {plan.subhead}
                    </Text>
                  )}

                  <Text style={[styles.planIncludes, { color: colors.textSecondary }]}>
                    {`Includes ${plan.included_devices} devices, ${plan.included_seats} seats, ${plan.included_credits} credits`}
                  </Text>

                  {plan.selling_points?.map((point) => (
                    <View key={point} style={styles.pointRow}>
                      <Ionicons name="checkmark" size={16} color={colors.primary} />
                      <Text style={[styles.pointText, { color: colors.textSecondary }]}>{point}</Text>
                    </View>
                  ))}
                </TouchableOpacity>
              );
            })}

            {(addons.devices || addons.seats) && (
              <View style={[styles.addonBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Add-ons</Text>
                {addons.devices && (
                  <Text style={[styles.addonText, { color: colors.textSecondary }]}>
                    {`Extra devices: ${formatCurrency(addons.devices.unit_price_monthly, addons.devices.currency)} each per month`}
                  </Text>
                )}
                {addons.seats && (
                  <Text style={[styles.addonText, { color: colors.textSecondary }]}>
                    {`Extra seats: ${formatCurrency(addons.seats.unit_price_monthly, addons.seats.currency)} each per month`}
                  </Text>
                )}
              </View>
            )}

            {showPayment && selectedPlan ? (
              <SubscriptionSetup
                planSlug={selectedPlan.slug}
                interval={billingInterval}
                planName={selectedPlan.name}
                onSubscriptionSuccess={() => navigation.replace('ManageBilling')}
                onSubscriptionError={() => setShowPayment(false)}
                onCancel={() => setShowPayment(false)}
              />
            ) : (
              <TouchableOpacity
                style={[styles.subscribeButton, { backgroundColor: colors.primary }]}
                onPress={handleSubscribe}
                disabled={!selectedPlan}
              >
                <Text style={styles.subscribeButtonText}>
                  {`Subscribe — ${formatCurrency(price, currency)}${billingInterval === 'annual' ? '/yr' : '/mo'}`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={styles.linksContainer}>
          {[
            { label: 'Manage Billing', icon: 'card-outline', dest: 'ManageBilling' },
            { label: 'Billing Analytics', icon: 'stats-chart-outline', dest: 'BillingAnalytics' },
            { label: 'Invoices', icon: 'receipt-outline', dest: 'PaymentHistory' },
          ].map((link) => (
            <TouchableOpacity
              key={link.dest}
              style={[styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate(link.dest)}
            >
              <Ionicons name={link.icon} size={22} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.textPrimary }]}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={20} color="#CCC" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  header: { padding: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  headerSubtitle: { fontSize: 15 },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  toggleRow: { flexDirection: 'row', margin: 20, borderRadius: 10, overflow: 'hidden' },
  toggleButton: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#EEE' },
  toggleText: { fontSize: 15, fontWeight: '600' },
  planCard: { marginHorizontal: 20, marginBottom: 14, padding: 18, borderRadius: 12, borderWidth: 1 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  planName: { fontSize: 18, fontWeight: '700' },
  planPrice: { fontSize: 20, fontWeight: '700' },
  planPeriod: { fontSize: 13, fontWeight: '400' },
  planSubhead: { fontSize: 14, marginTop: 6 },
  planIncludes: { fontSize: 13, marginTop: 10, marginBottom: 6 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  pointText: { fontSize: 13, flex: 1 },
  addonBox: { marginHorizontal: 20, marginBottom: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  addonText: { fontSize: 13, marginBottom: 4 },
  subscribeButton: { marginHorizontal: 20, paddingVertical: 15, borderRadius: 10, alignItems: 'center' },
  subscribeButtonText: { color: '#000', fontSize: 16, fontWeight: '700' },
  linksContainer: { margin: 20, gap: 10 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '500' },
});

export default DataHandlingFeeScreen;
