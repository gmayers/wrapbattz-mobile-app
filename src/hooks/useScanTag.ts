import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NfcManager from 'react-native-nfc-manager';
import { nfcService } from '../services/NFCService';

export interface UseScanTagResult {
  scan: () => Promise<void>;
}

// Module-level so the FAB and Dashboard tile share one in-flight slot — tapping
// either while a scan is already running is a no-op rather than a second
// requestTechnology() that blows up with "You can only issue one request at a
// time".
let scanInFlight = false;

/**
 * Starts the NFC reader and routes to QuickActionModal on success. Shared by the
 * center Scan FAB (MainTabBar) and the Scan tile on the Dashboard so both paths
 * have identical behavior, error handling, and cancellation semantics.
 */
export function useScanTag(): UseScanTagResult {
  const navigation = useNavigation<any>();

  const scan = useCallback(async () => {
    if (scanInFlight) return;
    scanInFlight = true;
    // Defensive: if a previous session left a tech request hanging, cancelling
    // here clears the native lock before we issue the next one.
    try { await NfcManager.cancelTechnologyRequest(); } catch { /* no-op */ }
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
    } finally {
      scanInFlight = false;
    }
  }, [navigation]);

  return { scan };
}
