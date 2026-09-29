import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import DropdownJs from '../../components/Dropdown';
import * as organizationsApi from '../../api/endpoints/organizations';
import type { OrganizationRead, OrganizationUpdate } from '../../api/types';
import { ApiError, normalizeFormError } from '../../api/errors';

// Owner/admin. Whether person-to-person transfers need the recipient to
// accept, and when unanswered ones expire (the org's workday end, in the
// org's timezone). Saved through PATCH /organizations/me/.

// Dropdown.js infers every prop as required; the optional ones really are.
const Dropdown = DropdownJs as React.ComponentType<any>;

const TIMEZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Asia/Dubai',
];

// "18:00:00" / "18:00" → "18:00"
export function toHHMM(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '18:00';
}

const TIMES = Array.from({ length: 29 }, (_, i) => {
  const minutes = 8 * 60 + i * 30; // 08:00 … 22:00
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

const TransferSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const [org, setOrg] = useState<OrganizationRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOrg(await organizationsApi.getMyOrganization());
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      setError(normalizeFormError(err, 'Could not load transfer settings.').message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: OrganizationUpdate) => {
    if (!org) return;
    const previous = org;
    setOrg({ ...org, ...(patch as Partial<OrganizationRead>) });
    setSaving(true);
    try {
      setOrg(await organizationsApi.updateMyOrganization(patch));
    } catch (err) {
      setOrg(previous);
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      Alert.alert('Could not save', normalizeFormError(err, 'Please try again.').message);
    } finally {
      setSaving(false);
    }
  };

  const s = styles(colors);

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.body}>{error}</Text>
        <TouchableOpacity style={s.retry} onPress={load} accessibilityRole="button">
          <Text style={s.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!org) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const time = toHHMM(org.workday_end_time);
  const timeItems = (TIMES.includes(time) ? TIMES : [time, ...TIMES]).map((t) => ({ label: t, value: t }));
  const tzItems = (TIMEZONES.includes(org.timezone) ? TIMEZONES : [org.timezone, ...TIMEZONES]).map((tz) => ({
    label: tz.replace('_', ' '),
    value: tz,
  }));

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.card}>
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Recipient must accept</Text>
            <Text style={s.body}>
              When on, a tool handed to someone stays with the sender until they accept it in the app.
              When off, it moves straight away.
            </Text>
          </View>
          <Switch
            value={org.require_transfer_confirmation}
            onValueChange={(v) => save({ require_transfer_confirmation: v })}
            disabled={saving}
            accessibilityLabel="Recipient must accept transfers"
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      {org.require_transfer_confirmation ? (
        <View style={s.card}>
          <Text style={s.title}>Unanswered transfers expire</Text>
          <Text style={s.body}>
            At the end of the working day. The tool stays with the sender, and the sender plus all owners and admins are notified.
          </Text>
          <Dropdown
            label="Workday ends at"
            value={time}
            items={timeItems}
            onValueChange={(v: string) => save({ workday_end_time: `${v}:00` })}
            disabled={saving}
            testID="transfer-workday-end"
          />
          <Dropdown
            label="Timezone"
            value={org.timezone}
            items={tzItems}
            onValueChange={(v: string) => save({ timezone: v })}
            disabled={saving}
            testID="transfer-timezone"
          />
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = (c: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.background, padding: 16 },
    card: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
    body: { color: c.textSecondary, fontSize: 14 },
    retry: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
    retryText: { color: '#000', fontWeight: '600' },
  });

export default TransferSettingsScreen;
