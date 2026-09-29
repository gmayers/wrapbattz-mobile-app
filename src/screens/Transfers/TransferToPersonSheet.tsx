import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import * as membersApi from '../../api/endpoints/members';
import * as transfersApi from '../../api/endpoints/transfers';
import type { MemberRead, TransferRead } from '../../api/types';
import { ApiError, normalizeFormError } from '../../api/errors';

export function memberName(m: Pick<MemberRead, 'first_name' | 'last_name' | 'email'>): string {
  const full = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim();
  return full || m.email;
}

interface Props {
  visible: boolean;
  toolId: number;
  toolName: string;
  /** Current holder — can't be the recipient. */
  holderUserId: number | null;
  onClose: () => void;
  /** Called after the backend accepted the request (pending or immediate). */
  onDone: (transfer: TransferRead, recipient: MemberRead) => void;
}

const TransferToPersonSheet: React.FC<Props> = ({
  visible,
  toolId,
  toolName,
  holderUserId,
  onClose,
  onDone,
}) => {
  const { colors } = useTheme();
  const [members, setMembers] = useState<MemberRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MemberRead | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await membersApi.listMembers({ page_size: 100 });
      setMembers(page.items.filter((m) => m.is_active && m.user_id !== holderUserId));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      setLoadError(normalizeFormError(err, 'Could not load team members.').message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setNote('');
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, holderUserId]);

  const send = async () => {
    if (!selected || sending) return;
    setSending(true);
    try {
      const transfer = await transfersApi.createTransfer({
        tool_id: toolId,
        to_user_id: selected.user_id,
        note: note.trim(),
      });
      onDone(transfer, selected);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      Alert.alert('Transfer failed', normalizeFormError(err, 'Could not transfer the tool. Please try again.').message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]} testID="transfer-person-sheet">
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Transfer to person</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose who is taking {toolName}. They may need to accept before it moves to them.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : loadError ? (
            <TouchableOpacity onPress={load} accessibilityRole="button">
              <Text style={[styles.error, { color: colors.error }]}>{loadError} Tap to retry.</Text>
            </TouchableOpacity>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(m) => String(m.user_id)}
              style={styles.list}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.textSecondary }]}>
                  No other team members to transfer to.
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = selected?.user_id === item.user_id;
                return (
                  <TouchableOpacity
                    style={[styles.row, { borderColor: isSelected ? colors.primary : colors.border }]}
                    onPress={() => setSelected(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Transfer to ${memberName(item)}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: colors.textPrimary }]}>{memberName(item)}</Text>
                      {memberName(item) !== item.email ? (
                        <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{item.email}</Text>
                      ) : null}
                    </View>
                    {isSelected ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            accessibilityLabel="Transfer note"
          />

          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }, (!selected || sending) && styles.disabled]}
            disabled={!selected || sending}
            onPress={send}
            accessibilityRole="button"
            accessibilityLabel="Send transfer"
            testID="transfer-person-send"
          >
            {sending ? <ActivityIndicator color="#000" /> : <Text style={styles.sendText}>Transfer</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: { padding: 20, paddingBottom: 32, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '85%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 12 },
  loader: { marginVertical: 24 },
  error: { fontSize: 14, marginVertical: 16 },
  empty: { fontSize: 14, textAlign: 'center', marginVertical: 16 },
  list: { flexGrow: 0, maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginTop: 8 },
  sendBtn: { marginTop: 14, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  sendText: { color: '#000', fontSize: 15, fontWeight: '700' },
});

export default TransferToPersonSheet;
