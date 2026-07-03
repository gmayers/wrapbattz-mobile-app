import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, View, Text, TextInput, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMyTools, ToolItem } from './hooks/useMyTools';
import { filterGroupsByQuery } from './hooks/filterGroups';
import SiteGroupHeader from './components/SiteGroupHeader';
import ToolsListItem from './components/ToolsListItem';
import AdminToolsToggle from './components/AdminToolsToggle';

const ToolsScreen: React.FC = () => {
  const { userData } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isAdminOrOwner = userData?.role === 'admin' || userData?.role === 'owner';
  const { isLoading, hasLoadedOnce, groups, filter, setFilter, error } = useMyTools(
    isAdminOrOwner ? 'all' : 'mine'
  );

  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  // "Find Tool" quick action lands here with focusSearch — focus once per visit.
  // Clear the param inside the timeout: clearing it synchronously re-runs this
  // effect (the param is a dependency) and its cleanup would cancel the timer
  // before the focus ever fires. Gate on hasLoadedOnce: during first load the
  // component renders the loader below (no search input to focus), so wait
  // until that flips true — the param is still set (only cleared inside the
  // timer), so this effect re-runs and focus fires then.
  useEffect(() => {
    if (route.params?.focusSearch && hasLoadedOnce) {
      const t = setTimeout(() => {
        searchRef.current?.focus();
        navigation.setParams({ focusSearch: undefined });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [route.params?.focusSearch, navigation, hasLoadedOnce]);

  const visibleGroups = useMemo(() => filterGroupsByQuery(groups, query), [groups, query]);
  const sections = visibleGroups.map(g => ({ title: g.siteName, data: g.tools, group: g }));

  const handleToolPress = (t: ToolItem) => navigation.navigate('DeviceDetails', { deviceId: t.id });

  if (isLoading && !hasLoadedOnce) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading tools…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          ref={searchRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search tools by name, serial, make…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search tools"
          testID="tools-search-input"
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {isAdminOrOwner ? (
        <View style={styles.toggleWrap}>
          <AdminToolsToggle value={filter} onChange={setFilter} />
        </View>
      ) : null}
      <SectionList
        sections={sections as any}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => <SiteGroupHeader group={(section as any).group} />}
        renderItem={({ item }) => <ToolsListItem item={item} onPress={handleToolPress} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          hasLoadedOnce && !isLoading && !error ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {query ? 'No tools match your search.' : 'No tools yet. Tap Scan to check a tag.'}
              </Text>
            </View>
          ) : null
        }
        stickySectionHeadersEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  toggleWrap: { paddingHorizontal: 12, paddingBottom: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, fontSize: 14 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});

export default ToolsScreen;
