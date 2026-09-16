import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  cancelSubscription,
  getBillingState,
  listInvoices,
  resumeSubscription,
} from '../../api/endpoints/billing';
import type { BillingState, Invoice } from '../../api/types-billing';
import { useTheme } from '../../context/ThemeContext';
import { manageCard } from './manageCard';

// Owner-only. Shows the Stripe subscription bought on the web and lets the
// owner manage the card and cancel/resume. Deliberately has no purchase,
// upgrade or sign-up path (App Store 3.1.1 / Play payments policy).

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const SubscriptionScreen: React.FC = () => {
  const { colors } = useTheme();
  const [state, setState] = useState<BillingState | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, inv] = await Promise.all([getBillingState(), listInvoices()]);
      setState(s);
      setInvoices(inv);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your subscription.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onCancel = () =>
    Alert.alert(
      'Cancel subscription?',
      'You keep access until the end of the current billing period.',
      [
        { text: 'Keep subscription', style: 'cancel' },
        { text: 'Cancel subscription', style: 'destructive', onPress: () => run(async () => setState(await cancelSubscription())) },
      ],
    );

  const onResume = () => run(async () => setState(await resumeSubscription()));

  const onManageCard = () =>
    run(async () => {
      if ((await manageCard()) === 'updated') Alert.alert('Card updated', 'Your default card has been updated.');
    });

  const s = styles(colors);

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.body}>{error}</Text>
        <Pressable style={s.button} onPress={load}>
          <Text style={s.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (!state) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hasStripe = Boolean(state.stripe_customer_id);
  const periodEnd = state.current_period_end ? day(state.current_period_end) : null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.label}>Plan</Text>
        <Text style={s.title}>{state.tier ?? 'No plan'}</Text>
        <Text style={s.body}>Status: {state.status}</Text>
        {periodEnd && (
          <Text style={s.body}>{state.cancel_at_period_end ? `Ends ${periodEnd}` : `Renews ${periodEnd}`}</Text>
        )}
        <Text style={s.body}>Seats: {state.limits.seats.used} of {state.limits.seats.limit}</Text>
        <Text style={s.body}>Tools: {state.limits.devices.used} of {state.limits.devices.limit}</Text>
      </View>

      {hasStripe ? (
        <View style={s.card}>
          <Pressable style={s.button} onPress={onManageCard} disabled={busy}>
            <Text style={s.buttonText}>Manage payment card</Text>
          </Pressable>
          {state.cancel_at_period_end ? (
            <Pressable style={s.button} onPress={onResume} disabled={busy}>
              <Text style={s.buttonText}>Resume subscription</Text>
            </Pressable>
          ) : (
            <Pressable style={[s.button, s.danger]} onPress={onCancel} disabled={busy}>
              <Text style={s.buttonText}>Cancel subscription</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={s.card}>
          {/* Plain text only: no link or button to a purchase flow. */}
          <Text style={s.body}>Subscriptions are managed at app.tooltraq.com</Text>
        </View>
      )}

      {invoices.length > 0 && (
        <View style={s.card}>
          <Text style={s.label}>Invoices</Text>
          {invoices.map((inv) => {
            const url = inv.pdf_url ?? inv.hosted_invoice_url;
            return (
              <Pressable key={inv.id} style={s.row} disabled={!url} onPress={() => url && Linking.openURL(url)}>
                <Text style={s.body}>
                  {inv.number ?? inv.id} · {day(inv.created_at)} · {money.format(inv.amount / 100)} · {inv.status}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {busy && <ActivityIndicator color={colors.primary} />}
    </ScrollView>
  );
};

const styles = (c: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.background, padding: 16 },
    card: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
    label: { color: c.textMuted, fontSize: 12, textTransform: 'uppercase' },
    title: { color: c.textPrimary, fontSize: 20, fontWeight: '600' },
    body: { color: c.textSecondary, fontSize: 14 },
    row: { paddingVertical: 8, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
    button: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    danger: { backgroundColor: c.error ?? '#D32F2F' },
    buttonText: { color: '#000', fontWeight: '600' },
  });

export default SubscriptionScreen;
