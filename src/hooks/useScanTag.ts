import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { nfcService } from '../services/NFCService';

export interface UseScanTagResult {
  scan: () => Promise<void>;
}

/**
 * Starts the NFC reader and routes to QuickActionModal on success. Shared by the
 * center Scan FAB (MainTabBar) and the Scan tile on the Dashboard so both paths
 * have identical behavior, error handling, and cancellation semantics.
 */
export function useScanTag(): UseScanTagResult {
  const navigation = useNavigation<any>();

  const scan = useCallback(async () => {
    try {
      const result = await nfcService.readNFC();
      if (result.success && (result.data as any)?.tagId) {
        const tagUID = String((result.data as any).tagId).toUpperCase();
        navigation.navigate('QuickActionModal', { tagUID });
        return;
      }
      Alert.alert('NFC read failed', result.error || 'No tag detected. Please try again.');
    } catch (err: any) {
      const msg = err?.message || 'Please try again.';
      if (/cancelled|not available|disabled/i.test(msg)) return;
      Alert.alert('NFC read failed', msg);
    }
  }, [navigation]);

  return { scan };
}
