import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import {
  useNotificationPolicy, useNotificationPreferences,
  useUpdateNotificationPolicy, useUpdateNotificationPreferences,
} from '../../notifications/queries';
import type { OrgPolicy, TypePolicy, TypePreference, UserPreferences } from '../../api/types';

type Channel = 'push' | 'email';

const NotificationSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { isAdminOrOwner } = useAuth();
  const prefsQ = useNotificationPreferences();
  const savePrefs = useUpdateNotificationPreferences();
  const policyQ = useNotificationPolicy(isAdminOrOwner);
  const savePolicy = useUpdateNotificationPolicy();

  if (prefsQ.isLoading) {
    return <ActivityIndicator style={styles.center} color={colors.primary} />;
  }
  if (prefsQ.isError || !prefsQ.data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textPrimary }}>Couldn't load notification settings</Text>
      </View>
    );
  }
  const prefs: UserPreferences = prefsQ.data;

  const setMaster = (channel: Channel, value: boolean) =>
    savePrefs.mutate({ ...prefs, master: { ...prefs.master, [channel]: value } });

  const setType = (row: TypePreference, channel: Channel, value: boolean) =>
    savePrefs.mutate({
      ...prefs,
      types: prefs.types.map((r) =>
        r.type === row.type ? { ...r, [channel]: { ...r[channel], enabled: value } } : r
      ),
    });

  const reason = (row: TypePreference) =>
    row.locked ? 'Required' : !row.push.editable && !row.email.editable ? 'Managed by your organisation' : null;

  const policy: OrgPolicy | undefined = policyQ.data;
  const setPolicy = (patch: Partial<OrgPolicy>) => policy && savePolicy.mutate({ ...policy, ...patch });
  const setPolicyType = (row: TypePolicy, patch: Partial<TypePolicy>) =>
    policy && savePolicy.mutate({
      ...policy,
      types: policy.types.map((r) => (r.type === row.type ? { ...r, ...patch } : r)),
    });

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
          {sw('All push notifications', prefs.master.push, (v) => setMaster('push', v))}
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Email notifications</Text>
          {sw('All email notifications', prefs.master.email, (v) => setMaster('email', v))}
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
            {sw(`${row.label} push`, row.push.enabled, (v) => setType(row, 'push', v), !row.push.editable)}
            {sw(`${row.label} email`, row.email.enabled, (v) => setType(row, 'email', v), !row.email.editable)}
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
              {sw('Members can turn off push', policy.members_can_disable_push, (v) => setPolicy({ members_can_disable_push: v }))}
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Members can turn off email</Text>
              {sw('Members can turn off email', policy.members_can_disable_email, (v) => setPolicy({ members_can_disable_email: v }))}
            </View>
            {policy.types.map((row) => (
              <View key={row.type} style={styles.policyRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>{row.label}</Text>
                <View style={styles.policySwitches}>
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Push</Text>
                  {sw(`${row.label} default push`, row.push_enabled, (v) => setPolicyType(row, { push_enabled: v }))}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Email</Text>
                  {sw(`${row.label} default email`, row.email_enabled, (v) => setPolicyType(row, { email_enabled: v }))}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Urgent</Text>
                  {sw(`${row.label} urgent`, row.urgent, (v) => setPolicyType(row, { urgent: v }))}
                  <Text style={[styles.note, { color: colors.textSecondary }]}>Lock</Text>
                  {sw(`${row.label} locked`, row.locked, (v) => setPolicyType(row, { locked: v }))}
                </View>
              </View>
            ))}
          </View>
        </>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});

export default NotificationSettingsScreen;
