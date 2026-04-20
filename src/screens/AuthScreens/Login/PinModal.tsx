import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';

export type PinModalMode = 'setup' | 'confirm' | 'entry';

interface PinModalProps {
  visible: boolean;
  mode: PinModalMode;
  title?: string;
  subtitle?: string;
  errorText?: string;
  attemptsRemaining?: number;
  onSubmit: (pin: string) => Promise<void> | void;
  onCancel: () => void;
  minLength?: number;
  maxLength?: number;
}

const DOT_COUNT_MIN = 4;
const DOT_COUNT_MAX = 6;

const PinModal: React.FC<PinModalProps> = ({
  visible,
  mode,
  title,
  subtitle,
  errorText,
  attemptsRemaining,
  onSubmit,
  onCancel,
  minLength = DOT_COUNT_MIN,
  maxLength = DOT_COUNT_MAX,
}) => {
  const { colors } = useTheme();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      setSubmitting(false);
      const id = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(id);
    }
  }, [visible]);

  const defaultTitle =
    mode === 'setup' ? 'Set a PIN' : mode === 'confirm' ? 'Confirm PIN' : 'Enter PIN';
  const defaultSubtitle =
    mode === 'setup'
      ? 'Choose a 4–6 digit PIN to sign in on this device.'
      : mode === 'confirm'
      ? 'Re-enter your PIN to confirm.'
      : 'Enter your PIN to sign in.';

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, maxLength);
    setPin(digits);
  };

  const handleSubmit = async () => {
    if (pin.length < minLength || submitting) return;
    try {
      setSubmitting(true);
      await onSubmit(pin);
    } finally {
      setSubmitting(false);
    }
  };

  const renderDots = () => {
    const total = Math.max(minLength, Math.min(maxLength, pin.length || minLength));
    return (
      <View style={styles.dotsRow}>
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  borderColor: colors.borderInput,
                  backgroundColor: filled ? colors.primary : 'transparent',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => inputRef.current?.focus()}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title || defaultTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle || defaultSubtitle}
          </Text>

          {renderDots()}

          <TextInput
            ref={inputRef}
            value={pin}
            onChangeText={handleChange}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={maxLength}
            style={styles.hiddenInput}
            autoFocus
            onSubmitEditing={handleSubmit}
            testID="pin-input"
          />

          {errorText ? (
            <Text style={[styles.error, { color: colors.error }]} testID="pin-error">
              {errorText}
              {typeof attemptsRemaining === 'number' && attemptsRemaining > 0
                ? `  (${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} left)`
                : ''}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancel, { borderColor: colors.borderInput }]}
              onPress={onCancel}
              disabled={submitting}
              testID="pin-cancel"
            >
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.submit,
                {
                  backgroundColor: pin.length >= minLength ? colors.primary : colors.disabled,
                },
              ]}
              onPress={handleSubmit}
              disabled={pin.length < minLength || submitting}
              testID="pin-submit"
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={[styles.btnText, { color: '#000' }]}>
                  {mode === 'entry' ? 'Unlock' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  dotsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { borderWidth: 1 },
  submit: {},
  btnText: { fontSize: 16, fontWeight: '600' },
});

export default PinModal;
