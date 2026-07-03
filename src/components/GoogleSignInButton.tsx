import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const GoogleSignInButton: React.FC<Props> = ({ onPress, loading, disabled }) => {
  const { colors } = useTheme();
  const blocked = loading || disabled;
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.surface, borderColor: colors.borderInput },
        blocked && styles.blocked,
      ]}
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      testID="google-signin-button"
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} color={colors.textPrimary} style={styles.icon} />
          <Text style={[styles.label, { color: colors.textPrimary }]}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  blocked: { opacity: 0.6 },
  icon: { marginRight: 10 },
  label: { fontSize: 16, fontWeight: '600' },
});

export default GoogleSignInButton;
