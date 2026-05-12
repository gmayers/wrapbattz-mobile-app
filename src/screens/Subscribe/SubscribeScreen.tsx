import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import {
  iapService,
  fetchCatalog,
  productIdsForPlatform,
  type IapProduct,
} from '../../iap';
import { iapRestore } from '../../api/endpoints/billing';
import { useSubscription } from './hooks/useSubscription';
import { usePurchaseFlow } from './hooks/usePurchaseFlow';
import type { TierCatalogItem } from '../../api/types-billing';

const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
const GOOGLE_MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

const SubscribeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const sub = useSubscription();
  const flow = usePurchaseFlow();

  const [tiers, setTiers] = useState<TierCatalogItem[]>([]);
  const [products, setProducts] = useState<IapProduct[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    setLoadingCatalog(true);
    try {
      await iapService.init();
      const cat = await fetchCatalog();
      const ids = productIdsForPlatform(cat.items);
      const prods = await iapService.getProducts(ids);
      setTiers(cat.items);
      setProducts(prods);
    } catch (e: any) {
      setCatalogError(e?.message ?? 'Could not load plans.');
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (flow.status === 'active') sub.refresh();
  }, [flow.status, sub]);

  const productById = useMemo(() => {
    const m = new Map<string, IapProduct>();
    products.forEach((p) => m.set(p.productId, p));
    return m;
  }, [products]);

  const handleSubscribe = (tier: TierCatalogItem) => {
    const productId =
      Platform.OS === 'ios' ? tier.ios_product_id : tier.android_product_id;
    if (!productId) {
      Alert.alert('Unavailable', 'This plan is not available on your platform.');
      return;
    }
    flow.purchase(productId);
  };

  const handleManage = () => {
    Linking.openURL(Platform.OS === 'ios' ? APPLE_MANAGE_URL : GOOGLE_MANAGE_URL);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const purchases = await iapService.getAvailablePurchases();
      if (purchases.length === 0) {
        Alert.alert('No purchases found', 'There are no subscriptions tied to this account on this device.');
        return;
      }
      const restored = await iapRestore({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        receipts: purchases.map((p) => ({
          transaction_id: p.transactionId,
          receipt: p.transactionReceipt,
          product_id: p.productId,
        })),
      });
      await sub.refresh();
      if (restored.status === 'active') {
        Alert.alert('Restored', 'Your subscription has been restored.');
      } else {
        Alert.alert(
          'Nothing to restore',
          'No active subscription was found for this organization.',
        );
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const renderTier = (tier: TierCatalogItem) => {
    const productId =
      Platform.OS === 'ios' ? tier.ios_product_id : tier.android_product_id;
    const product = productId ? productById.get(productId) : undefined;
    const isCurrent = sub.state?.tier_id === tier.tier_id;
    const busy = flow.status === 'purchasing' || flow.status === 'verifying';
    return (
      <View
        key={tier.tier_id}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.tierName, { color: colors.textPrimary }]}>{tier.name}</Text>
        <Text style={[styles.tierPrice, { color: colors.primary }]}>
          {product?.localizedPrice ?? '—'}
          <Text style={[styles.tierPeriod, { color: colors.textSecondary }]}>
            {' / '}{tier.duration === 'annual' ? 'year' : 'month'}
          </Text>
        </Text>
        <Text style={[styles.tierDesc, { color: colors.textSecondary }]}>{tier.description}</Text>
        <View style={styles.featureList}>
          {tier.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textPrimary }]}>{f}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          disabled={isCurrent || busy || !product}
          style={[
            styles.cta,
            { backgroundColor: isCurrent ? colors.disabled : colors.primary },
          ]}
          onPress={() => handleSubscribe(tier)}
          accessibilityRole="button"
          accessibilityLabel={isCurrent ? `Current plan ${tier.name}` : `Subscribe to ${tier.name}`}
        >
          {busy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.ctaText}>
              {isCurrent ? 'Current plan' : !product ? 'Unavailable' : 'Subscribe'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Subscription</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.stateCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          {sub.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : sub.state?.source ? (
            <>
              <Text style={[styles.stateLabel, { color: colors.textSecondary }]}>Current plan</Text>
              <Text style={[styles.stateValue, { color: colors.textPrimary }]}>
                {sub.state.tier_id ?? 'Active'}
                {sub.state.status !== 'active' ? ` (${sub.state.status})` : ''}
              </Text>
              <Text style={[styles.stateMeta, { color: colors.textMuted }]}>
                {sub.state.managed_in === 'app_store'
                  ? 'Managed in the App Store'
                  : sub.state.managed_in === 'play_store'
                  ? 'Managed in Google Play'
                  : 'Managed in the web portal'}
              </Text>
              {(sub.state.source === 'apple_iap' || sub.state.source === 'google_iap') ? (
                <TouchableOpacity style={[styles.manageBtn, { borderColor: colors.border }]} onPress={handleManage}>
                  <Text style={[styles.manageText, { color: colors.primary }]}>Manage subscription</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <Text style={[styles.stateValue, { color: colors.textPrimary }]}>No active subscription</Text>
          )}
        </View>

        {loadingCatalog ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : catalogError ? (
          <View style={styles.center}>
            <Text style={[styles.error, { color: colors.textPrimary }]}>{catalogError}</Text>
            <TouchableOpacity onPress={loadCatalog} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tiers.map(renderTier)
        )}

        {flow.status === 'error' && flow.errorMessage ? (
          <Text style={[styles.flowError, { color: '#F85149' }]}>{flow.errorMessage}</Text>
        ) : null}
        {flow.status === 'pending' ? (
          <Text style={[styles.flowError, { color: colors.textSecondary }]}>
            Purchase is pending — we'll confirm when it clears.
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleRestore}
          disabled={restoring}
          style={styles.restoreBtn}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
        >
          {restoring ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.restoreText, { color: colors.primary }]}>Restore purchases</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#000', fontWeight: '600' },
  stateCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 18,
  },
  stateLabel: { fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  stateValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  stateMeta: { fontSize: 12, marginTop: 4 },
  manageBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  manageText: { fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 14,
  },
  tierName: { fontSize: 18, fontWeight: '700' },
  tierPrice: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  tierPeriod: { fontSize: 14, fontWeight: '500' },
  tierDesc: { fontSize: 13, marginTop: 4, marginBottom: 12 },
  featureList: { marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  featureText: { fontSize: 14 },
  cta: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaText: { color: '#000', fontWeight: '700', fontSize: 15 },
  flowError: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  restoreBtn: { marginTop: 18, padding: 12, alignItems: 'center' },
  restoreText: { fontSize: 14, fontWeight: '600' },
});

export default SubscribeScreen;
