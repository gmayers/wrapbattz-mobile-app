import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FilterChips, { FilterChipItem } from '../components/FilterChips';
import ApprovalsBanner from '../components/ApprovalsBanner';
import LocationCard from '../../shared/components/LocationCard';
import { palette } from '../../shared/palette';
import type { LocationItem } from '../types';

type WhereFilter = 'all' | 'sites' | 'vehicles' | 'toolboxes';

const FILTERS: FilterChipItem<WhereFilter>[] = [
  { key: 'all', label: 'All' },
  { key: 'sites', label: 'Sites' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'toolboxes', label: 'Toolboxes' },
];

interface Props {
  locations: LocationItem[];
  totalToolsPlaced: number;
  pendingApprovals: number | null;
  returnsDue: number | null;
  onLocationPress: (location: LocationItem) => void;
  onReview: () => void;
}

const KIND_FOR_FILTER: Record<WhereFilter, LocationItem['kind'] | null> = {
  all: null,
  sites: 'site',
  vehicles: 'vehicle',
  toolboxes: 'toolbox',
};

const WhereTab: React.FC<Props> = ({
  locations,
  totalToolsPlaced,
  pendingApprovals,
  returnsDue,
  onLocationPress,
  onReview,
}) => {
  const [filter, setFilter] = useState<WhereFilter>('all');

  const visible = useMemo(() => {
    const kind = KIND_FOR_FILTER[filter];
    if (kind === null) return locations;
    return locations.filter((l) => l.kind === kind);
  }, [filter, locations]);

  const rows = useMemo(() => {
    const out: LocationItem[][] = [];
    for (let i = 0; i < visible.length; i += 2) out.push(visible.slice(i, i + 2));
    return out;
  }, [visible]);

  return (
    <View>
      <ApprovalsBanner
        pendingApprovals={pendingApprovals}
        returnsDue={returnsDue}
        onReview={onReview}
      />
      <FilterChips items={FILTERS} value={filter} onChange={setFilter} />
      <View style={styles.headingRow}>
        <Text style={styles.heading}>LOCATIONS</Text>
        <Text style={styles.headingRight}>{totalToolsPlaced} devices placed</Text>
      </View>
      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No locations yet</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map((item) => (
                <LocationCard
                  key={item.id}
                  kind={item.kind}
                  name={item.name}
                  code={item.code}
                  toolCount={item.toolCount}
                  workerInitials={item.workerInitials}
                  onPress={() => onLocationPress(item)}
                />
              ))}
              {row.length === 1 ? <View style={styles.spacer} /> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  heading: { color: palette.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  headingRight: { color: palette.textMuted, fontSize: 12 },
  grid: { paddingHorizontal: 18 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  spacer: { flex: 1 },
  empty: { paddingHorizontal: 18, paddingVertical: 24 },
  emptyText: { color: palette.textMuted, fontSize: 13 },
});

export default WhereTab;
