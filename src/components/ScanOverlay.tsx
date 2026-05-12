import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScanState, cancelScan } from '../hooks/useScanTag';

// iOS shows a native NFC sheet via Core NFC; Android has no system UI, so this
// overlay provides the "hold your phone near the tag" affordance there.
const ScanOverlay: React.FC = () => {
  const scanning = useScanState();
  if (Platform.OS !== 'android') return null;
  const dismiss = () => {
    cancelScan();
  };
  return (
    <Modal visible={scanning} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconRing}>
            <Ionicons name="scan-outline" size={48} color="#FFC72C" />
          </View>
          <Text style={styles.title}>Ready to scan</Text>
          <Text style={styles.subtitle}>Hold your phone near the NFC tag.</Text>
          <ActivityIndicator color="#FFC72C" style={styles.spinner} />
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Cancel NFC scan"
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#161B22',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 199, 44, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#C9D1D9',
    textAlign: 'center',
  },
  spinner: { marginTop: 18 },
  cancelBtn: {
    marginTop: 22,
    paddingVertical: 10,
    paddingHorizontal: 26,
  },
  cancelText: {
    color: '#FFC72C',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default ScanOverlay;
