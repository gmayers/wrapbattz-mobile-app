import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import * as invitationsApi from '@/api/endpoints/invitations';
import type { InvitationRead } from '@/api/types';
import { ApiError } from '@/api/errors';
import { validation } from '@/utils/CommonUtils';
import { Role, ROLE_LABEL } from './roles';

export function canSubmitInvite(email: string, role: string): boolean {
  return validation.email(email.trim()) && !!role;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSent: (inv: InvitationRead) => void;
  roles: Role[];
}

const InviteMemberSheet: React.FC<Props> = ({ visible, onClose, onSent, roles }) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('site_worker');
  const [sending, setSending] = useState(false);

  const reset = () => {
    setEmail('');
    setRole('site_worker');
  };

  // Clear the draft on every close path (backdrop, Cancel, hardware back),
  // not just after a successful send.
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSend = async () => {
    if (!canSubmitInvite(email, role) || sending) return;
    setSending(true);
    try {
      const inv = await invitationsApi.createInvitation({ email: email.trim(), role });
      reset();
      onSent(inv);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not send the invitation. Please try again.';
      Alert.alert('Invite failed', msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Invite a team member</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            They'll receive an email with a link to join your organization.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email@company.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            accessibilityLabel="Invitee email"
            testID="invite-email-input"
          />
          <View style={styles.roleRow}>
            {roles.map((r) => {
              const active = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={[
                    styles.rolePill,
                    { borderColor: active ? colors.primary : colors.border },
                    active && { backgroundColor: colors.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Role ${ROLE_LABEL[r]}`}
                >
                  <Text style={[styles.rolePillText, { color: active ? '#000' : colors.textPrimary }]}>
                    {ROLE_LABEL[r]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary },
              (!canSubmitInvite(email, role) || sending) && styles.sendBtnDisabled,
            ]}
            disabled={!canSubmitInvite(email, role) || sending}
            onPress={handleSend}
            accessibilityRole="button"
            accessibilityLabel="Send invitation"
            testID="invite-send-button"
          >
            {sending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.sendBtnText}>Send Invitation</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel invitation"
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: { padding: 20, paddingBottom: 32, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  rolePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillText: { fontSize: 13, fontWeight: '600' },
  sendBtn: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  cancelBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600' },
});

export default InviteMemberSheet;
