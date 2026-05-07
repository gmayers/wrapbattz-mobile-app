import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../../shared/palette';

interface Props {
  checkedOut: number;
  returnedToday: number;
  overdueCount: number;
}

const TodayLogCard: React.FC<Props> = ({ checkedOut, returnedToday, overdueCount }) => (
  <View style={styles.card}>
    <Text style={styles.heading}>TODAY'S LOG</Text>
    <View style={styles.row}>
      <Cell value={checkedOut} label="CHECKED OUT" />
      <Cell value={returnedToday} label="RETURNED" />
      <Cell value={overdueCount} label="OVERDUE" tone="red" />
    </View>
  </View>
);

const Cell: React.FC<{ value: number; label: string; tone?: 'red' }> = ({ value, label, tone }) => (
  <View style={styles.cell}>
    <Text style={[styles.value, tone === 'red' ? styles.valueRed : null]}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: palette.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorder,
  },
  heading: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cell: {
    flex: 1,
    alignItems: 'flex-start',
  },
  value: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  valueRed: { color: palette.red },
  label: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 1.0,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default TodayLogCard;
