import { Platform } from 'react-native';
import { getCatalog } from '../api/endpoints/billing';
import type { CatalogResponse, TierCatalogItem } from '../api/types-billing';

export async function fetchCatalog(): Promise<CatalogResponse> {
  return getCatalog();
}

export function productIdsForPlatform(items: TierCatalogItem[]): string[] {
  const key = Platform.OS === 'ios' ? 'ios_product_id' : 'android_product_id';
  return items
    .map((i) => i[key])
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function tierForProductId(
  items: TierCatalogItem[],
  productId: string,
): TierCatalogItem | undefined {
  const key = Platform.OS === 'ios' ? 'ios_product_id' : 'android_product_id';
  return items.find((i) => i[key] === productId);
}
