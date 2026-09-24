import React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/errors';
import {
  useNotificationPolicy, useNotificationPreferences,
  useUpdateNotificationPolicy, useUpdateNotificationPreferences,
} from '../../notifications/queries';
import type { OrgPolicy, TypePolicy, TypePreference, UserPreferences } from '../../api/types';

type Channel = 'push' | 'email';

// A PUT that changes a non-editable preference is rejected with 403
// {code: 'preference_not_editable'} — surface that as "your org controls
// this" rather than a generic failure message. Any other failure (network,
// validation, 5xx, …) gets a generic retry message; the query refetch that
// follows the mutation's settle restores whatever the server actually has,
// so the UI never sits silently out of sync with it.
function describeSaveError(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.status === 403 &&
    (error.detail as { code?: string } | null)?.code === 'preference_not_editable'
  ) {
    return 'Your organisation manages this setting.';
  }
  return "Couldn't save your changes. Please try again.";
}

const showSaveError = (error: unknown) => Alert.alert("Couldn't save", describeSaveError(error));

const NotificationSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { isAdminOrOwner } = useAuth();
  const prefsQ = useNotificationPreferences();
  const savePrefs = useUpdateNotificationPreferences();
  const policyQ = useNotificationPolicy(isAdminOrOwner);
  const savePolicy = useUpdateNotificationPolicy();

  if (prefsQ.isLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <ActivityIndicator style={styles.center} color={colors.primary} />
      </View>
    );
  }
  if (prefsQ.isError || !prefsQ.data) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={{ color: colors.textPrimary }}>Couldn't load notification settings</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void prefsQ.refetch()}
            style={[styles.retry, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  const prefs: UserPreferences = prefsQ.data;

  // setMaster is always allowed — the master switches have no per-row
  // editable flag. setType and the policy setters re-check editability /
  // admin status themselves (defence in depth for Android, where a disabled
  // Switch can still fire onValueChange from some accessibility services).
  const setMaster = (channel: Channel, value: boolean) =>
    savePrefs.mutate(
      { ...prefs, master: { ...prefs.master, [channel]: value } },
      { onError: showSaveError }
    );

  const setType = (row: TypePreference, channel: Channel, value: boolean) => {
    if (!row[channel].editable) return;
    savePrefs.mutate(
      {
        ...prefs,
        types: prefs.types.map((r) =>
          r.type === row.type ? { ...r, [channel]: { ...r[channel], enabled: value } } : r
        ),
      },
      { onError: showSaveError }
    );
  };

  const reason = (row: TypePreference) =>
    row.locked ? 'Required' : !row.push.editable && !row.email.editable ? 'Managed by your organisation' : null;

  const policy: OrgPolicy | undefined = policyQ.data;
  const setPolicy = (patch: Partial<OrgPolicy>) => {
    if (!isAdminOrOwner || !policy) return;
    savePolicy.mutate({ ...policy, ...patch }, { onError: showSaveError });
  };
  const setPolicyType = (row: TypePolicy, patch: Partial<TypePolicy>) => {
    if (!isAdminOrOwner || !policy) return;
    savePolicy.mutate(
      { ...policy, types: policy.types.map((r) => (r.type === row.type ? { ...r, ...patch } : r)) },
      { onError: showSaveError }
    );
  };

  const sw = (label: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <Switch
      accessibilityLabel={label}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: colors.disabled, true: colors.primary }}
    />
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.h, { color: colors.textPrimary }]}>All notifications</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Push notifications</Text>
          {sw('All push notifications', prefs.master.push, (v) => setMaster('push', v), savePrefs.isPending)}
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Email notifications</Text>
          {sw('All email notifications', prefs.master.email, (v) => setMaster('email', v), savePrefs.isPending)}
        </View>
      </View>

      <Text style={[styles.h, { color: colors.textPrimary }]}>By type</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }} />
          <Text style={[styles.col, { color: colors.textSecondary }]}>Push</Text>
          <Text style={[styles.col, { color: colors.textSecondary }]}>Email</Text>
        </View>
        {prefs.types.map((row) => (
          <View key={row.type} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>{row.label}</Text>
              {reason(row) ? (
                <Text style={[styles.note, { color: colors.textSecondary }]}>{reason(row)}</Text>
              ) : null}
            </View>
            {sw(`${row.label} push`, row.push.enabled, (v) => setType(row, 'push', v), savePrefs.isPending || !row.push.editable)}
            {sw(`${row.label} email`, row.email.enabled, (v) => setType(row, 'email', v), savePrefs.isPending || !row.email.editable)}
          </View>
        ))}
      </View>

      {isAdminOrOwner && policy ? (
        <>
          <Text style={[styles.h, { color: colors.textPrimary }]}>Organisation defaults</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Email digest</Text>
              {[30, 60].map((m) => (
                <TouchableOpacity
                  key={m}
                  accessibilityLabel={m === 30 ? 'Digest every 30 minutes' : 'Digest every hour'}
                  onPress={() => setPolicy({ digest_minutes: m })}
                  disabled={savePolicy.isPending}
                  style={[styles.chip, policy.digest_minutes === m && { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: policy.digest_minutes === m ? '#111' : colors.textSecondary }}>
                    {m === 30 ? '30 min' : '1 hour'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Members can turn off push</Text>
              {sw('Members can turn off push', policy.members_can_disable_push, (v) => setPolicy({ members_can_disable_push: v }), savePolicy.isPending)}
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Members can turn off email</Text>
              {sw('Members can turn off email', policy.members_can_disable_email, (v) => setPolicy({ members_can_disable_email: v }), savePolicy.isPending)}
            </View>
            {policy.types.map((row) => (
              <View key={row.type} style={styles.policyRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>{row.label}</Text>
                <View style={styles.policySwitches}>
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Push</Text>
                  {sw(`${row.label} default push`, row.push_enabled, (v) => setPolicyType(row, { push_enabled: v }), savePolicy.isPending)}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Email</Text>
                  {sw(`${row.label} default email`, row.email_enabled, (v) => setPolicyType(row, { email_enabled: v }), savePolicy.isPending)}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Urgent</Text>
                  {sw(`${row.label} urgent`, row.urgent, (v) => setPolicyType(row, { urgent: v }), savePolicy.isPending)}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Lock</Text>
                  {sw(`${row.label} locked`, row.locked, (v) => setPolicyType(row, { locked: v }), savePolicy.isPending)}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {isAdminOrOwner && !policy && policyQ.isError ? (
        <View style={[styles.row, styles.policyError]}>
          <Text style={[styles.label, { flex: 1, color: colors.textSecondary }]}>
            Couldn't load organisation defaults
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry loading organisation defaults"
            onPress={() => void policyQ.refetch()}
            style={[styles.chip, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  h: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  card: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  policyRow: { paddingVertical: 10 },
  policySwitches: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  label: { fontSize: 15 },
  note: { fontSize: 12, marginTop: 2 },
  col: { width: 52, textAlign: 'center', fontSize: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  retry: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#111', fontWeight: '600' },
  policyError: { marginTop: 16 },
});

export default NotificationSettingsScreen;
