import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createStoreLink, getStoreCredit } from '../../api/endpoints/billing';
import type { StoreCredit, StoreCreditRow } from '../../api/types-billing';
import { useTheme } from '../../context/ThemeContext';

// Owner-only. The plan's monthly sticker credit, held in the owner's
// BattWrapz shop account. Spending happens in the shop (physical goods,
// so outside App Store / Play billing); this screen only shows the
// balance and history and opens the shop signed in.

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function rowTitle(row: StoreCreditRow): string {
  if (row.kind === 'added') return 'Monthly credit added';
  if (row.kind === 'expired') return 'Unspent credit expired';
  return 'Adjustment';
}

export function rowAmount(row: StoreCreditRow): string {
  return `${row.credits < 0 ? '−' : '+'}${row.amount_display}`;
}

const ShopCreditScreen: React.FC = () => {
  const { colors } = useTheme();
  const [credit, setCredit] = useState<StoreCredit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCredit(await getStoreCredit());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your shop credit.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onSpend = async () => {
    setOpening(true);
    try {
      const { url } = await createStoreLink();
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Couldn't open the shop", e?.message ?? 'Please try again.');
    } finally {
      setOpening(false);
    }
  };

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
  if (!credit) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!credit.wallet_enabled) {
    return (
      <View style={s.center}>
        <Text style={s.body}>Shop credit isn't available yet. We'll let you know when it is.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={s.card}>
        <Text style={s.label}>Credit to spend</Text>
        {credit.balance_display ? (
          <Text style={s.balance} testID="shop-credit-balance">{credit.balance_display}</Text>
        ) : (
          <Text style={s.body}>Your balance isn't available right now. It's safe in your shop account — check again shortly.</Text>
        )}
        {credit.next_expiry && (
          <Text style={s.body}>Some of it expires on {day(credit.next_expiry)} — spend it before then.</Text>
        )}
        <Text style={s.muted}>Spend it on NFC tags and wraps at the BattWrapz shop. It's taken off at checkout automatically.</Text>
        {credit.held_by_you ? (
          <Pressable style={[s.button, opening && s.disabled]} onPress={onSpend} disabled={opening}>
            {opening ? <ActivityIndicator color="#000" /> : <Text style={s.buttonText}>Spend in store</Text>}
          </Pressable>
        ) : (
          <Text style={s.body}>
            The credit is in {credit.holder_name}'s shop account, as the account owner. Ask them to use it, or to buy for the team.
          </Text>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.label}>Recent credit</Text>
        {credit.history.length === 0 ? (
          <Text style={s.body}>No credit yet. It's added each month when your plan renews.</Text>
        ) : (
          <>
            {credit.history.map((row, i) => (
              <View key={`${row.date}-${i}`} style={s.row}>
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>{rowTitle(row)}</Text>
                  <Text style={s.muted}>
                    {day(row.date)}
                    {row.expires_at ? ` · use by ${day(row.expires_at)}` : ''}
                    {row.pending ? ' · on its way to the shop' : ''}
                  </Text>
                </View>
                <Text style={[s.amount, row.kind === 'expired' && s.amountMuted]}>{rowAmount(row)}</Text>
              </View>
            ))}
            <Text style={s.muted}>What you spend shows in your shop account's order history.</Text>
          </>
        )}
      </View>
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
    balance: { color: c.textPrimary, fontSize: 32, fontWeight: '700' },
    body: { color: c.textSecondary, fontSize: 14, textAlign: 'left' },
    muted: { color: c.textMuted, fontSize: 12 },
    row: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
      paddingVertical: 8, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth,
    },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { color: c.textPrimary, fontSize: 14 },
    amount: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
    amountMuted: { color: c.textMuted },
    button: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    disabled: { opacity: 0.6 },
    buttonText: { color: '#000', fontWeight: '600' },
  });

export default ShopCreditScreen;
