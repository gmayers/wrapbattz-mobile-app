import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';
import * as organizationsApi from '../../api/endpoints/organizations';
import type { NfcLockCodeType, NfcLockConfig } from '../../api/types';
import { ApiError, normalizeFormError } from '../../api/errors';
import { useNfcLock } from '../../hooks/useNfcLock';
import { setNfcLockConfig } from '../../services/nfcLockStore';

// Owner/admin. One lock code for the whole organisation: the app password-
// protects every tag it writes with it. Saved through
// PUT/DELETE /organizations/me/nfc-lock/. The code is shown masked until
// revealed and is never stored on the device.

export function validateLockCode(type: NfcLockCodeType, code: string): string | null {
  if (type === 'pin') return /^\d{4,8}$/.test(code) ? null : 'Enter 4 to 8 digits.';
  return /^[0-9a-fA-F]{8}$/.test(code) ? null : 'Enter exactly 8 characters using 0–9 and A–F.';
}

const NfcLockSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user, isAdminOrOwner } = useAuth();
  const { viewer, config, loaded, error, refresh } = useNfcLock(user?.id, !!isAdminOrOwner);

  const [codeType, setCodeType] = useState<NfcLockCodeType>('pin');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);

  const s = styles(colors);

  if (!isAdminOrOwner) {
    return (
      <View style={s.center}>
        <Text style={s.body}>Only owners and admins can manage the NFC tag lock.</Text>
      </View>
    );
  }
  if (!loaded) {
    return (
      <View style={s.center}>
        {error ? (
          <>
            <Text style={s.body}>{error}</Text>
            <TouchableOpacity style={s.retry} onPress={refresh} accessibilityRole="button">
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const enabled = !!config?.enabled;
  const hasPrevious = !!config?.previous_password_hex;

  const apply = async (request: () => Promise<NfcLockConfig>, opts: { reveal?: boolean } = {}) => {
    setSaving(true);
    setFieldError(null);
    try {
      const updated = await request();
      setNfcLockConfig(viewer, updated);
      setCode('');
      setRevealed(!!opts.reveal);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') return;
      const normalized = normalizeFormError(err, 'Could not save the lock code. Please try again.');
      const message = normalized.fieldErrors.code || normalized.message;
      if (err instanceof ApiError && err.code === 'validation') setFieldError(message);
      else Alert.alert('Could not save', message);
    } finally {
      setSaving(false);
    }
  };

  const saveCode = () => {
    const trimmed = code.trim();
    const problem = validateLockCode(codeType, trimmed);
    if (problem) {
      setFieldError(problem);
      return;
    }
    apply(() =>
      organizationsApi.setNfcLock({ code_type: codeType, code: codeType === 'hex' ? trimmed.toUpperCase() : trimmed })
    );
  };

  const generate = () => apply(() => organizationsApi.setNfcLock({ generate: true }), { reveal: true });

  const turnOff = () => {
    Alert.alert(
      'Turn off the tag lock?',
      'New tags will be written without a lock. Tags that are already locked stay locked until the app next writes them, then the lock is removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: () => apply(() => organizationsApi.disableNfcLock()) },
      ]
    );
  };

  const masked = config?.code ? '•'.repeat(config.code.length) : '';

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.title}>NFC tag lock</Text>
          <Text style={[s.badge, enabled ? s.badgeOn : s.badgeOff]} testID="nfc-lock-status">
            {enabled ? 'On' : 'Off'}
          </Text>
        </View>
        <Text style={s.body}>
          {enabled
            ? 'Every tag written in the ToolTraq app is locked with this code. Tags stay scannable — anyone can still read them — but rewriting or erasing a tag needs the code.'
            : 'Lock tags so only owners and admins can rewrite or erase them. Tags stay scannable — anyone can still read them.'}
        </Text>

        {enabled && config?.code ? (
          <View style={s.codeRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{config.code_type === 'hex' ? 'Hex code' : 'PIN'}</Text>
              <Text style={s.code} testID="nfc-lock-code" selectable={revealed}>
                {revealed ? config.code : masked}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setRevealed((r) => !r)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide lock code' : 'Show lock code'}
              style={s.reveal}
            >
              <Text style={s.revealText}>{revealed ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!enabled && hasPrevious ? (
          <Text style={s.body}>
            Tags locked with your old code can still be updated: the app removes their lock the next time it writes them.
          </Text>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.title}>{enabled ? 'Change the code' : 'Set a code'}</Text>
        <View style={s.segment}>
          {(['pin', 'hex'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => {
                setCodeType(t);
                setFieldError(null);
              }}
              style={[s.segmentItem, codeType === t && s.segmentItemActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: codeType === t }}
              testID={`nfc-lock-type-${t}`}
            >
              <Text style={[s.segmentText, codeType === t && s.segmentTextActive]}>
                {t === 'pin' ? 'PIN (4–8 digits)' : 'Hex code (8 characters)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setFieldError(null);
          }}
          placeholder={codeType === 'pin' ? 'e.g. 4821' : 'e.g. 3F9A01C7'}
          placeholderTextColor={colors.textSecondary}
          keyboardType={codeType === 'pin' ? 'number-pad' : 'default'}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={8}
          style={[s.input, fieldError ? s.inputError : null]}
          accessibilityLabel="New lock code"
          testID="nfc-lock-input"
        />
        {fieldError ? (
          <Text style={s.error} testID="nfc-lock-error">
            {fieldError}
          </Text>
        ) : null}
        <Button title="Save code" onPress={saveCode} loading={saving} disabled={saving} testID="nfc-lock-save" />
        <Button
          title="Generate a code"
          onPress={generate}
          variant="outlined"
          disabled={saving}
          testID="nfc-lock-generate"
        />
        {enabled ? (
          <Text style={s.body}>
            Changing the code keeps the old one, so tags locked with it can still be updated. They're re-locked with the new
            code the next time they're written.
          </Text>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.title}>Good to know</Text>
        <Text style={s.body}>• Only owners and admins can see the code or rewrite locked tags.</Text>
        <Text style={s.body}>
          • Tags are locked when they're written in the ToolTraq app on iPhone or Android. Use "Lock this tag" on a scanned
          tag to lock one without rewriting it.
        </Text>
        <Text style={s.body}>
          • Writing tags from the web or desktop app can't unlock them — rewrite locked tags in the ToolTraq app.
        </Text>
        <Text style={s.body}>• Locking needs NTAG213, NTAG215 or NTAG216 tags. Other tags are written without a lock.</Text>
      </View>

      {enabled ? (
        <Button
          title="Turn off tag lock"
          onPress={turnOff}
          variant="outlined"
          disabled={saving}
          textColorProp={colors.error || '#D32F2F'}
          testID="nfc-lock-disable"
        />
      ) : null}
    </ScrollView>
  );
};

const styles = (c: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 16, paddingBottom: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.background, padding: 16 },
    card: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
    body: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
    label: { color: c.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
    badgeOn: { backgroundColor: c.primary, color: '#000' },
    badgeOff: { backgroundColor: c.border, color: c.textSecondary },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
    code: { color: c.textPrimary, fontSize: 22, fontWeight: '600', letterSpacing: 3, fontVariant: ['tabular-nums'] },
    reveal: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    revealText: { color: c.textPrimary, fontWeight: '600' },
    segment: { flexDirection: 'row', gap: 8 },
    segmentItem: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    segmentItemActive: { borderColor: c.primary, backgroundColor: c.primary },
    segmentText: { color: c.textPrimary, fontSize: 13 },
    segmentTextActive: { color: '#000', fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 18,
      letterSpacing: 2,
      color: c.textPrimary,
      backgroundColor: c.background,
    },
    inputError: { borderColor: c.error || '#D32F2F' },
    error: { color: c.error || '#D32F2F', fontSize: 13 },
    retry: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
    retryText: { color: '#000', fontWeight: '600' },
  });

export default NfcLockSettingsScreen;
