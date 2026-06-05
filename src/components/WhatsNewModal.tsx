import React, { createContext, useContext } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { CHANGELOG } from '../constants/changelog';
import { useWhatsNew } from '../hooks/useWhatsNew';

// ── Modal UI ────────────────────────────────────────────────────────────────

interface WhatsNewModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ visible, onDismiss }) => {
  const { colors } = useTheme();
  const entry = CHANGELOG[0];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.iconRing, { backgroundColor: colors.primaryTint10 }]}>
            <Ionicons name="sparkles-outline" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>What's New</Text>
          <Text style={[styles.versionBadge, { color: colors.textSecondary }]}>
            v{entry.version} · {entry.date}
          </Text>

          {/* Highlights */}
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {entry.highlights.map((item, idx) => (
              <View key={idx} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{item}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Got it button */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={onDismiss}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss What's New"
          >
            <Text style={[styles.btnText, { color: colors.onPrimary }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Provider / Context ───────────────────────────────────────────────────────

interface WhatsNewContextValue {
  openManually: () => void;
}

const WhatsNewContext = createContext<WhatsNewContextValue>({ openManually: () => {} });

export const useWhatsNewPrompt = () => useContext(WhatsNewContext);

export const WhatsNewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { visible, dismiss, openManually } = useWhatsNew();

  return (
    <WhatsNewContext.Provider value={{ openManually }}>
      {children}
      <WhatsNewModal visible={visible} onDismiss={dismiss} />
    </WhatsNewContext.Provider>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

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
    maxWidth: 360,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    maxHeight: '85%',
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  versionBadge: {
    fontSize: 13,
    marginBottom: 18,
  },
  scroll: {
    width: '100%',
    maxHeight: 300,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  btn: {
    marginTop: 20,
    width: '100%',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default WhatsNewModal;
