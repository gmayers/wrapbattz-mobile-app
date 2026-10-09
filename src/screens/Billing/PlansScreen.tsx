import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getPlans } from '../../api/endpoints/billing';
import type { PlanSummary } from '../../api/types-billing';
import { useTheme } from '../../context/ThemeContext';

// Read-only plan catalog from the live /billing/plans/ endpoint. Information
// only: no purchase, upgrade or external link (App Store 3.1.1 / Play
// payments policy). One card per row so text stays full-size at phone width.

type Interval = 'monthly' | 'annual';

const money = (pence: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);

// 0 included = unlimited, matching the backend.
const allowance = (n: number, one: string, many: string) =>
  n === 0 ? `Unlimited ${many}` : `${n} ${n === 1 ? one : many}`;

const PlansScreen: React.FC = () => {
  const { colors } = useTheme();
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>('monthly');

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlans((await getPlans()).plans);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load plans.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const s = styles(colors);

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.body}>{error}</Text>
        <Pressable style={s.retry} onPress={load}>
          <Text style={s.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (!plans) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.heading}>Plans</Text>
      <Text style={s.body}>Every plan includes NFC tool tracking for your whole team.</Text>

      <View style={s.toggle} accessibilityRole="tablist">
        {(['monthly', 'annual'] as const).map((value) => {
          const selected = interval === value;
          return (
            <Pressable
              key={value}
              style={[s.toggleOption, selected && s.toggleSelected]}
              onPress={() => setInterval(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[s.toggleText, selected && s.toggleTextSelected]}>
                {value === 'monthly' ? 'Monthly' : 'Annual'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {plans.map((plan) => {
        const price = interval === 'annual' ? plan.annual_price : plan.monthly_price;
        return (
          <View key={plan.slug} style={s.card}>
            <Text style={s.name}>{plan.name}</Text>
            {!!plan.subhead && <Text style={s.body}>{plan.subhead}</Text>}
            <View style={s.priceRow}>
              <Text style={s.price}>{price == null ? 'Contact us' : money(price)}</Text>
              {price != null && (
                <Text style={s.period}>{interval === 'annual' ? 'per year' : 'per month'}</Text>
              )}
            </View>
            <Text style={s.allowance}>
              {allowance(plan.included_seats, 'user', 'users')} · {allowance(plan.included_devices, 'tool', 'tools')}
            </Text>
            {plan.selling_points.map((point) => (
              <View key={point} style={s.point}>
                <Text style={s.tick}>✓</Text>
                <Text style={s.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = (c: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.background, padding: 16 },
    heading: { color: c.textPrimary, fontSize: 24, fontWeight: '700' },
    body: { color: c.textSecondary, fontSize: 15, lineHeight: 21 },
    toggle: { flexDirection: 'row', backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 10, padding: 4 },
    toggleOption: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    toggleSelected: { backgroundColor: c.primary },
    toggleText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    toggleTextSelected: { color: c.onPrimary ?? '#000' },
    card: { backgroundColor: c.card ?? c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
    name: { color: c.textPrimary, fontSize: 20, fontWeight: '700' },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
    price: { color: c.textPrimary, fontSize: 28, fontWeight: '800' },
    period: { color: c.textSecondary, fontSize: 15 },
    allowance: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    point: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    tick: { color: c.primary, fontSize: 16, fontWeight: '700', lineHeight: 22 },
    pointText: { color: c.textSecondary, fontSize: 15, lineHeight: 22, flex: 1 },
    retry: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
    retryText: { color: c.onPrimary ?? '#000', fontWeight: '600' },
  });

export default PlansScreen;
