import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NfcManager from 'react-native-nfc-manager';
import { nfcService } from '../services/NFCService';

// Module-level inflight flag with a subscribe-able mirror. The boolean prevents
// re-entrant calls to requestTechnology() while a scan is already pending; the
// listeners let an Android-only overlay react to scan state without prop
// drilling or a Context provider (Context would force a navigator-tree shape we
// don't want).
let scanInFlight = false;
const listeners = new Set<(scanning: boolean) => void>();

function setInFlight(v: boolean): void {
  scanInFlight = v;
  listeners.forEach((l) => l(v));
}

/** Subscribe to scan state. Used by the Android `ScanOverlay`. */
export function useScanState(): boolean {
  const [s, setS] = useState(scanInFlight);
  useEffect(() => {
    listeners.add(setS);
    setS(scanInFlight);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

/** Cancel any in-flight scan. Safe when nothing is scanning. */
export async function cancelScan(): Promise<void> {
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    /* no-op */
  }
  setInFlight(false);
}

export interface UseScanTagResult {
  scan: () => Promise<void>;
  cancel: () => Promise<void>;
}

/**
 * Starts the NFC reader and routes to QuickActionModal on success. Shared by
 * the center Scan FAB (MainTabBar) and the Scan tile on the Dashboard so both
 * paths share inflight state, error handling, and overlay rendering.
 */
export function useScanTag(): UseScanTagResult {
  const navigation = useNavigation<any>();

  const scan = useCallback(async () => {
    if (scanInFlight) return;
    setInFlight(true);
    // Defensive: clear any prior hung tech request before issuing the next one.
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      /* no-op */
    }
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
      setInFlight(false);
    }
  }, [navigation]);

  return { scan, cancel: cancelScan };
}
