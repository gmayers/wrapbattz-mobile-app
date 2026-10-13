import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  cancelSubscription,
  getBillingState,
  getSubscriptionSource,
  listInvoices,
  resumeSubscription,
} from '../../api/endpoints/billing';
import type { BillingState, Invoice, LimitBlock, SubscriptionSource } from '../../api/types-billing';
import { useTheme } from '../../context/ThemeContext';
import { manageCard } from './manageCard';

// Owner-only. Shows the Stripe subscription bought on the web and lets the
// owner manage the card and cancel/resume. Deliberately has no purchase,
// upgrade or sign-up path (App Store 3.1.1 / Play payments policy).

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  past_due: 'Payment overdue',
  trial: 'Free trial',
  trial_expired: 'Trial ended',
  grace: 'Lapsed',
  canceled: 'Cancelled',
  incomplete: 'Payment not completed',
  none: 'No subscription',
};
const statusLabel = (status: string) => STATUS_LABELS[status] ?? status.replace(/_/g, ' ');

// Plan slugs ("crew-control") → "Crew Control".
const planName = (slug: string) =>
  slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const usage = (b: LimitBlock) => (b.unlimited || b.limit == null ? `${b.used} (unlimited)` : `${b.used} of ${b.limit}`);

// Subscriptions bought through a store are managed there, not with Stripe.
const STORE: Record<string, { name: string; url: string }> = {
  app_store: { name: 'the App Store', url: 'https://apps.apple.com/account/subscriptions' },
  play_store: { name: 'Google Play', url: 'https://play.google.com/store/account/subscriptions' },
};

const SubscriptionScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const [state, setState] = useState<BillingState | null>(null);
  const [source, setSource] = useState<SubscriptionSource | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, inv, src] = await Promise.all([
        getBillingState(),
        listInvoices(),
        // Only used to spot store-managed subscriptions; Stripe is the fallback.
        getSubscriptionSource().catch(() => null),
      ]);
      setState(s);
      setInvoices(inv);
      setSource(src);
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

  const store = source?.managed_in ? STORE[source.managed_in] : undefined;
  const hasStripe = Boolean(state.stripe_customer_id) && !store;
  const isLive = state.status === 'active' || state.status === 'past_due';
  // A Stripe customer can exist with a subscription that has since ended
  // (GRACE / CANCELED) or never started (TRIAL / INCOMPLETE) — the
  // manage/cancel/resume actions only make sense while there's a live
  // Stripe subscription to act on.
  const isLiveSubscription = hasStripe && isLive;
  const periodEnd = state.current_period_end ? day(state.current_period_end) : null;

  // What to say when there's a Stripe customer but nothing to manage yet/any more.
  const stripeNotice = (() => {
    switch (state.status) {
      case 'trial':
        return state.trial_ends_at ? `Your free trial ends ${day(state.trial_ends_at)}.` : 'You are on a free trial.';
      case 'trial_expired':
        return 'Your free trial has ended.';
      case 'incomplete':
        return "Your first payment hasn't gone through yet.";
      case 'grace':
        return state.grace_ends_at
          ? `Your subscription has lapsed. Full access continues until ${day(state.grace_ends_at)}.`
          : 'Your subscription has lapsed.';
      default:
        return 'Your subscription has ended.';
    }
  })();

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.label}>Plan</Text>
        <Text style={s.title}>{state.tier ? planName(state.tier) : 'No plan'}</Text>
        <Text style={s.body}>Status: {statusLabel(state.status)}</Text>
        {(isLiveSubscription || (store && isLive)) && periodEnd && (
          <Text style={s.body}>{state.cancel_at_period_end ? `Ends ${periodEnd}` : `Renews ${periodEnd}`}</Text>
        )}
        <Text style={s.body}>Seats: {usage(state.limits.seats)}</Text>
        <Text style={s.body}>Tools: {usage(state.limits.devices)}</Text>
        {/* Read-only plan list, no purchase path. Android only (App Store 3.1.1). */}
        {Platform.OS === 'android' && navigation && (
          <Pressable onPress={() => navigation.navigate('Plans')}>
            <Text style={s.link}>View plans</Text>
          </Pressable>
        )}
      </View>

      {store ? (
        <View style={s.card}>
          <Text style={s.body}>
            This subscription was bought through {store.name}. Change or cancel it there.
          </Text>
          <Pressable onPress={() => Linking.openURL(store.url)}>
            <Text style={s.link}>Manage in {store.name}</Text>
          </Pressable>
        </View>
      ) : isLiveSubscription ? (
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
      ) : hasStripe ? (
        <View style={s.card}>
          {/* Trial / incomplete / grace / canceled: no actions to take here. */}
          <Text style={s.body}>{stripeNotice}</Text>
        </View>
      ) : (
        <View style={s.card}>
          {/* Plain text only: no link or button to a purchase flow. */}
          <Text style={s.body}>Your organisation doesn't have an active subscription.</Text>
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
    link: { color: c.primary, fontSize: 14, fontWeight: '600' },
    row: { paddingVertical: 8, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
    button: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    danger: { backgroundColor: c.error ?? '#D32F2F' },
    buttonText: { color: '#000', fontWeight: '600' },
  });

export default SubscriptionScreen;
