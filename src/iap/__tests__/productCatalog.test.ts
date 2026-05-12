import { Platform } from 'react-native';
import * as billingApi from '../../api/endpoints/billing';
import { fetchCatalog, productIdsForPlatform } from '../productCatalog';
import type { TierCatalogItem } from '../../api/types-billing';

jest.mock('../../api/endpoints/billing');

const items: TierCatalogItem[] = [
  {
    tier_id: 'pro_monthly',
    name: 'Pro',
    description: '',
    features: [],
    asset_cap: 50,
    duration: 'monthly',
    ios_product_id: 'com.tooltraq.sub.pro.monthly',
    android_product_id: 'tooltraq_sub_pro_monthly',
    stripe_price_id: null,
    sort_order: 10,
  },
  {
    tier_id: 'business_monthly',
    name: 'Business',
    description: '',
    features: [],
    asset_cap: 250,
    duration: 'monthly',
    ios_product_id: null,
    android_product_id: 'tooltraq_sub_business_monthly',
    stripe_price_id: null,
    sort_order: 20,
  },
];

describe('productCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (billingApi.getCatalog as jest.Mock).mockResolvedValue({ items });
  });

  it('fetches catalog from backend', async () => {
    const res = await fetchCatalog();
    expect(res.items.length).toBe(2);
  });

  it('extracts iOS product IDs, skipping tiers without an iOS id', () => {
    (Platform as any).OS = 'ios';
    expect(productIdsForPlatform(items)).toEqual(['com.tooltraq.sub.pro.monthly']);
  });

  it('extracts Android product IDs', () => {
    (Platform as any).OS = 'android';
    expect(productIdsForPlatform(items)).toEqual([
      'tooltraq_sub_pro_monthly',
      'tooltraq_sub_business_monthly',
    ]);
  });
});
