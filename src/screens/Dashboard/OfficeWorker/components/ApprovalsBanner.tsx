import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../shared/palette';

interface Props {
  pendingApprovals: number | null;
  returnsDue: number | null;
  onReview: () => void;
}

const ApprovalsBanner: React.FC<Props> = ({ pendingApprovals, returnsDue, onReview }) => {
  const parts: string[] = [];
  if (pendingApprovals != null) {
    parts.push(`${pendingApprovals} pending approval${pendingApprovals === 1 ? '' : 's'}`);
  }
  if (returnsDue != null) {
    parts.push(`${returnsDue} return${returnsDue === 1 ? '' : 's'} due`);
  }
  if (parts.length === 0) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle-outline" size={18} color={palette.amber} />
      <Text style={styles.text}>{parts.join(' · ')}</Text>
      <TouchableOpacity onPress={onReview} accessibilityRole="button" accessibilityLabel="Review approvals">
        <Text style={styles.action}>Review →</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  text: { flex: 1, color: palette.textSecondary, fontSize: 13 },
  action: { color: palette.amber, fontSize: 13, fontWeight: '700' },
});

export default ApprovalsBanner;
