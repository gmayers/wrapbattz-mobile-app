import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import * as transfersApi from '../../api/endpoints/transfers';
import type { TransferRead } from '../../api/types';
import { ApiError, normalizeFormError } from '../../api/errors';
import { queryClient } from '../../query/queryClient';

// Transfers the user closed the modal on. Module-level so it survives
// re-focusing the dashboard but resets on the next app launch — the design
// wants the modal back every launch until each transfer is actioned.
const dismissedIds = new Set<number>();

export function __resetDismissedTransfersForTests() {
  dismissedIds.clear();
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function senderLabel(t: TransferRead): string {
  return t.from_user_email || 'A team member';
}

const PendingTransfersModal: React.FC = () => {
  const { colors } = useTheme();
  const [transfers, setTransfers] = useState<TransferRead[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const pending = await transfersApi.listPendingForMe();
      setTransfers(pending.filter((t) => !dismissedIds.has(t.id)));
    } catch {
      // Non-critical: the dashboard still works, and the transfer's push
      // notification is another way in.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = (id: number) => setTransfers((prev) => prev.filter((t) => t.id !== id));

  const decide = async (t: TransferRead, action: 'accept' | 'decline') => {
    setBusyId(t.id);
    try {
      if (action === 'accept') {
        await transfersApi.acceptTransfer(t.id);
      } else {
        await transfersApi.declineTransfer(t.id);
      }
      remove(t.id);
      // Custody moved (or didn't) — refresh "my tools" counts and lists.
      queryClient.invalidateQueries();
      if (action === 'accept') {
        Alert.alert('Transfer accepted', `${t.tool_name} is now assigned to you.`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      const { message } = normalizeFormError(err, 'Could not update the transfer. Please try again.');
      Alert.alert(action === 'accept' ? 'Could not accept' : 'Could not decline', message);
      // Expired / custody changed / already decided: the row is stale.
      if (err instanceof ApiError && err.code === 'conflict') load();
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = () => {
    transfers.forEach((t) => dismissedIds.add(t.id));
    setTransfers([]);
  };

  const visible = transfers.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]} testID="pending-transfers-modal">
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {transfers.length === 1 ? 'A tool is being handed to you' : 'Tools are being handed to you'}
            </Text>
            <TouchableOpacity
              onPress={dismiss}
              accessibilityRole="button"
              accessibilityLabel="Close pending transfers"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Accept once you have the tool in hand. Until then it stays with the sender.
          </Text>
          <ScrollView style={styles.list}>
            {transfers.map((t) => {
              const busy = busyId === t.id;
              const expiry = formatExpiry(t.expires_at);
              return (
                <View
                  key={t.id}
                  style={[styles.card, { borderColor: colors.border }]}
                  testID={`pending-transfer-${t.id}`}
                >
                  <Text style={[styles.toolName, { color: colors.textPrimary }]}>{t.tool_name}</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>From {senderLabel(t)}</Text>
                  {t.note ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>“{t.note}”</Text>
                  ) : null}
                  {expiry ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>Expires {expiry}</Text>
                  ) : null}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.decline, { borderColor: colors.border }]}
                      onPress={() => decide(t, 'decline')}
                      disabled={busyId != null}
                      accessibilityRole="button"
                      accessibilityLabel={`Decline ${t.tool_name}`}
                    >
                      <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: colors.primary }]}
                      onPress={() => decide(t, 'accept')}
                      disabled={busyId != null}
                      accessibilityRole="button"
                      accessibilityLabel={`Accept ${t.tool_name}`}
                    >
                      {busy ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text style={[styles.buttonText, { color: '#000' }]}>Accept</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 16, padding: 20, maxHeight: '80%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  subtitle: { fontSize: 13, marginTop: 6, marginBottom: 12 },
  list: { flexGrow: 0 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  toolName: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 3 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  decline: { borderWidth: 1 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});

export default PendingTransfersModal;
